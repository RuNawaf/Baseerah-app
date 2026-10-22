// Real Chromium + axe-core against the local fixture website.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crawlWebsite } from '../../src/crawler/crawler.js';
import { createBrowserManager } from '../../src/scanner/browser.js';
import { scanPage } from '../../src/scanner/pageScanner.js';
import { startFixtureServers } from '../fixtures/serve.js';

const allowAll = async () => {};

let fixtures;
let browserManager;
let browser;

beforeAll(async () => {
  fixtures = await startFixtureServers();
  browserManager = createBrowserManager({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  browser = await browserManager.getBrowser();
});

afterAll(async () => {
  await browserManager?.close();
  await fixtures?.close();
});

function scanner(timeoutMs = 8000) {
  return (url) => scanPage({ browser, url, origin: fixtures.siteOrigin, timeoutMs, guardHost: allowAll });
}

describe('website crawl on the fixture site (US-04, US-06)', () => {
  let result;
  beforeAll(async () => {
    result = await crawlWebsite({
      startUrl: `${fixtures.siteOrigin}/`,
      origin: fixtures.siteOrigin,
      limits: { maxPages: 50, maxDepth: 5, concurrency: 3, maxDurationMs: 120_000 },
      scanPage: scanner(),
    });
  });

  const pathOf = (page) => {
    const url = new URL(page.url);
    return url.pathname + url.search;
  };

  it('scans every internal HTML page exactly once', () => {
    expect(result.pages.map(pathOf).sort()).toEqual(
      [
        '/',
        '/about.html',
        '/about.html?a=1&b=2',
        '/contact/',
        '/deep/1.html',
        '/deep/2.html',
        '/deep/3.html',
        '/deep/4.html',
        '/missing.html',
        '/redirect-me',
      ].sort(),
    );
  });

  it('never visits the external website', () => {
    expect(fixtures.hits.external).toEqual([]);
  });

  it('never requests non-HTML links as pages', () => {
    const pageRequests = fixtures.hits.site;
    for (const file of ['/files/menu.pdf', '/files/data.json', '/files/promo.mp4', '/files/brochure.html', '/files/app.js']) {
      expect(pageRequests).not.toContain(file);
    }
  });

  it('runs axe-core on each loaded page and records the issues', () => {
    const home = result.pages.find((p) => pathOf(p) === '/');
    expect(home.status).toBe('succeeded');
    expect(home.issueCount).toBeGreaterThan(0);
    const ruleIds = home.violations.map((v) => v.id);
    expect(ruleIds).toEqual(expect.arrayContaining(['image-alt', 'color-contrast']));
    expect(home.violations[0].nodes[0]).toHaveProperty('html');

    const about = result.pages.find((p) => pathOf(p) === '/about.html');
    expect(about.violations.map((v) => v.id)).toContain('label');

    const contact = result.pages.find((p) => pathOf(p) === '/contact/');
    expect(contact.violations.map((v) => v.id)).toContain('button-name');
  });

  it('records the broken link as a failed page and continues (US-06 AC-3)', () => {
    const missing = result.pages.find((p) => pathOf(p) === '/missing.html');
    expect(missing.status).toBe('failed');
    expect(missing.error.code).toBe('HTTP_ERROR');
    expect(missing.error.message).toContain('404');
    expect(result.pages.filter((p) => p.status === 'succeeded')).toHaveLength(8);
  });

  it('does not count a redirect to an already scanned page twice', () => {
    const redirect = result.pages.find((p) => pathOf(p) === '/redirect-me');
    expect(redirect.status).toBe('skipped');
  });

  it('never submits forms', () => {
    expect(fixtures.hits.site.some((url) => url.startsWith('/subscribe'))).toBe(false);
  });
});

describe('single page failures (US-06 AC-2)', () => {
  it('times out a page that never responds', async () => {
    const result = await scanner(1500)(`${fixtures.siteOrigin}/slow.html`);
    expect(result.status).toBe('failed');
    expect(result.error.code).toBe('TIMEOUT');
  });

  it('fails a server error page with the HTTP status', async () => {
    const result = await scanner()(`${fixtures.siteOrigin}/server-error.html`);
    expect(result.error).toMatchObject({ code: 'HTTP_ERROR' });
    expect(result.error.message).toContain('500');
  });

  it('rejects non-HTML content', async () => {
    const result = await scanner()(`${fixtures.siteOrigin}/files/data.json`);
    expect(result.error.code).toBe('UNSUPPORTED_CONTENT');
  });

  it('rejects a page that redirects to another website', async () => {
    const result = await scanner()(`${fixtures.siteOrigin}/leave`);
    expect(result.error.code).toBe('REDIRECTED_EXTERNAL');
  });

  it('aborts requests the SSRF guard refuses', async () => {
    const result = await scanPage({
      browser,
      url: `${fixtures.siteOrigin}/`,
      origin: fixtures.siteOrigin,
      timeoutMs: 5000,
      guardHost: async () => {
        throw new Error('blocked');
      },
    });
    expect(result.status).toBe('failed');
    expect(result.error.code).toBe('BLOCKED_ADDRESS');
  });
});