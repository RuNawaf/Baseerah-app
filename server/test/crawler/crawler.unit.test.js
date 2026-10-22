import { describe, expect, it } from 'vitest';
import { crawlWebsite } from '../../src/crawler/crawler.js';

const ORIGIN = 'https://site.test';
const LIMITS = { maxPages: 50, maxDepth: 5, concurrency: 3, maxDurationMs: 60_000 };

/** A fake website: path -> links on that page. Missing paths fail like a 404. */
function fakeSite(graph, { redirects = {}, delayMs = 0 } = {}) {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const scanPage = async (url) => {
    calls.push(url);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, delayMs));
    active -= 1;
    const { pathname, search } = new URL(url);
    const target = redirects[pathname] ?? pathname + search;
    const links = graph[target];
    if (!links) {
      return { status: 'failed', finalUrl: url, links: [], error: { code: 'HTTP_ERROR', message: 'HTTP 404' } };
    }
    return { status: 'succeeded', finalUrl: ORIGIN + target, links: links.map((l) => new URL(l, ORIGIN + target).href), issueCount: 1, violations: [] };
  };
  return { scanPage, calls, getMaxActive: () => maxActive };
}

function crawl(site, limits = {}) {
  return crawlWebsite({ startUrl: `${ORIGIN}/`, origin: ORIGIN, limits: { ...LIMITS, ...limits }, scanPage: site.scanPage });
}

describe('crawlWebsite (US-04)', () => {
  it('visits each normalized page once, even with duplicate, fragment and looping links', async () => {
    const site = fakeSite({
      '/': ['/a', '/a', '/a#x', './a', '/b?y=2&x=1', '/b?x=1&y=2', '/'],
      '/a': ['/', '/b?x=1&y=2', '/a'],
      '/b?x=1&y=2': ['/a', '/'],
    });
    const result = await crawl(site);
    expect(site.calls.sort()).toEqual([`${ORIGIN}/`, `${ORIGIN}/a`, `${ORIGIN}/b?x=1&y=2`]);
    expect(result.pages.every((p) => p.status === 'succeeded')).toBe(true);
    expect(result.limitsReached).toEqual([]);
  });

  it('never follows external, non-http or file links', async () => {
    const site = fakeSite({
      '/': ['https://other.test/', 'https://sub.site.test/', 'mailto:a@b.c', 'tel:1', '/doc.pdf', '/pic.png', '/ok'],
      '/ok': [],
    });
    await crawl(site);
    expect(site.calls).toEqual([`${ORIGIN}/`, `${ORIGIN}/ok`]);
  });

  it('records a failed page and keeps scanning the rest (US-06 AC-3)', async () => {
    const site = fakeSite({ '/': ['/broken', '/fine'], '/fine': ['/deeper'], '/deeper': [] });
    const result = await crawl(site);
    const byPath = Object.fromEntries(result.pages.map((p) => [new URL(p.url).pathname, p.status]));
    expect(byPath).toEqual({ '/': 'succeeded', '/broken': 'failed', '/fine': 'succeeded', '/deeper': 'succeeded' });
  });

  it('stops at the page limit and reports it', async () => {
    const links = Array.from({ length: 20 }, (_, i) => `/p${i}`);
    const graph = { '/': links, ...Object.fromEntries(links.map((l) => [l, []])) };
    const result = await crawl(fakeSite(graph), { maxPages: 5 });
    expect(result.pages).toHaveLength(5);
    expect(result.limitsReached.map((l) => l.type)).toEqual(['maxPages']);
    expect(result.limitsReached[0].message).toMatch(/5-page limit/);
  });

  it('stops at the depth limit and reports it', async () => {
    const site = fakeSite({ '/': ['/1'], '/1': ['/2'], '/2': ['/3'], '/3': ['/4'], '/4': [] });
    const result = await crawl(site, { maxDepth: 2 });
    expect(site.calls.map((u) => new URL(u).pathname)).toEqual(['/', '/1', '/2']);
    expect(result.limitsReached.map((l) => l.type)).toEqual(['maxDepth']);
  });

  it('never runs more pages at once than the concurrency setting', async () => {
    const links = Array.from({ length: 12 }, (_, i) => `/p${i}`);
    const site = fakeSite({ '/': links, ...Object.fromEntries(links.map((l) => [l, []])) }, { delayMs: 10 });
    await crawl(site, { concurrency: 3 });
    expect(site.getMaxActive()).toBe(3);
    expect(site.calls).toHaveLength(13);
  });

  it('skips queued pages and warns when the time limit is reached', async () => {
    let clock = 0;
    const site = fakeSite({ '/': ['/a', '/b', '/c'], '/a': [], '/b': [], '/c': [] });
    const scanPage = async (url) => {
      clock += 40_000; // every page "takes" 40 seconds
      return site.scanPage(url);
    };
    const result = await crawlWebsite({
      startUrl: `${ORIGIN}/`,
      origin: ORIGIN,
      limits: { ...LIMITS, concurrency: 1, maxDurationMs: 60_000 },
      scanPage,
      now: () => clock,
    });
    expect(result.limitsReached.map((l) => l.type)).toEqual(['maxDuration']);
    expect(result.pages.filter((p) => p.status === 'skipped').length).toBeGreaterThan(0);
  });

  it('marks a URL that redirects to an already scanned page as skipped', async () => {
    const site = fakeSite({ '/': ['/old', '/new'], '/new': [] }, { redirects: { '/old': '/new' } });
    const result = await crawl(site, { concurrency: 1 });
    const statuses = Object.fromEntries(result.pages.map((p) => [new URL(p.url).pathname, p.status]));
    expect(statuses).toEqual({ '/': 'succeeded', '/old': 'succeeded', '/new': 'skipped' });
  });

  it('survives a scanPage implementation that throws', async () => {
    const result = await crawlWebsite({
      startUrl: `${ORIGIN}/`,
      origin: ORIGIN,
      limits: LIMITS,
      scanPage: async () => {
        throw new Error('bug');
      },
    });
    expect(result.startPage.status).toBe('failed');
    expect(result.startPage.error.code).toBe('SCAN_FAILED');
  });
});