import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createBrowserManager } from '../../src/scanner/browser.js';
import { createScanService } from '../../src/services/scanService.js';
import { startFixtureServers } from '../fixtures/serve.js';
import { fakeLookup, logger, testConfig, waitForScan } from '../helpers.js';

const UUID = /^[0-9a-f-]{36}$/;

let fixtures;
const services = [];

function buildApp({ env = {}, ...overrides } = {}) {
  const config = testConfig(env);
  const browserManager = createBrowserManager({ executablePath: config.chromiumExecutable });
  const scanService = createScanService({ config, logger, browserManager, ...overrides });
  services.push(scanService);
  return request(createApp({ config, logger, scanService }));
}

beforeAll(async () => {
  fixtures = await startFixtureServers();
});

afterAll(async () => {
  await Promise.all(services.map((s) => s.close()));
  await fixtures?.close();
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await buildApp().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.limits).toEqual({ maxPages: 50, maxDepth: 5, pageTimeoutMs: 8000, concurrency: 3, maxDurationMs: 600000 });
  });
});

describe('POST /api/scans validation (US-01, US-02, US-03)', () => {
  const api = () => buildApp({ env: { ALLOW_PRIVATE_NETWORK_TARGETS: 'false' }, lookup: fakeLookup({ 'private.test': ['10.0.0.8'] }) });

  it.each([
    [{ url: '' }, 400, 'EMPTY_URL'],
    [{ url: '   ' }, 400, 'EMPTY_URL'],
    [{}, 400, 'EMPTY_URL'],
    [{ url: 'http://exa mple.com' }, 400, 'INVALID_URL'],
    [{ url: 'https://' }, 400, 'INVALID_URL'],
    [{ url: 'ftp://example.com/file' }, 400, 'UNSUPPORTED_PROTOCOL'],
    [{ url: 'javascript:alert(1)' }, 400, 'UNSUPPORTED_PROTOCOL'],
    [{ url: 'http://localhost:4000' }, 400, 'BLOCKED_ADDRESS'],
    [{ url: 'http://127.0.0.1/' }, 400, 'BLOCKED_ADDRESS'],
    [{ url: 'http://169.254.169.254/latest/meta-data/' }, 400, 'BLOCKED_ADDRESS'],
    [{ url: 'http://[::1]:8080/' }, 400, 'BLOCKED_ADDRESS'],
    [{ url: 'http://192.168.1.1/' }, 400, 'BLOCKED_ADDRESS'],
    [{ url: 'https://private.test/' }, 400, 'BLOCKED_ADDRESS'],
    [{ url: 'https://unknown-domain.test/' }, 422, 'DNS_NOT_FOUND'],
    [{ url: 42 }, 400, 'INVALID_REQUEST'],
  ])('%j -> %i %s', async (body, status, code) => {
    const res = await api().post('/api/scans').send(body);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.message).toEqual(expect.any(String));
    expect(res.body.scanId).toBeUndefined();
  });

  it('rejects invalid JSON and oversized bodies without leaking details', async () => {
    const bad = await api().post('/api/scans').set('content-type', 'application/json').send('{"url":');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_REQUEST');

    const big = await api().post('/api/scans').send({ url: 'x'.repeat(20_000) });
    expect(big.status).toBe(413);
    expect(JSON.stringify(big.body)).not.toMatch(/stack|node_modules/);
  });

  it('reports an unreachable website (nothing listening)', async () => {
    const res = await buildApp().post('/api/scans').send({ url: 'http://127.0.0.1:9/' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNREACHABLE');
  });

  it('reports a website that answers with an error status', async () => {
    const res = await buildApp().post('/api/scans').send({ url: `${fixtures.siteOrigin}/missing.html` });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HTTP_ERROR');
  });

  it('reports a website that does not respond in time', async () => {
    const res = await buildApp({ env: { VALIDATION_TIMEOUT_MS: '800' } })
      .post('/api/scans')
      .send({ url: `${fixtures.siteOrigin}/slow.html` });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TIMEOUT');
  });

  it('rate limits scan creation', async () => {
    const limited = buildApp({ env: { RATE_LIMIT_PER_MINUTE: '2' } });
    await limited.post('/api/scans').send({ url: '' });
    await limited.post('/api/scans').send({ url: '' });
    const res = await limited.post('/api/scans').send({ url: '' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('full website scan through the API (US-04, US-05)', () => {
  it('returns a scan ID, reports progress, and completes with a report', async () => {
    const api = buildApp();
    const start = await api.post('/api/scans').send({ url: `${fixtures.siteOrigin}/#intro` });
    expect(start.status).toBe(202);
    expect(start.body.scanId).toMatch(UUID);
    expect(start.headers.location).toBe(`/api/scans/${start.body.scanId}`);
    expect(['queued', 'running']).toContain(start.body.status);
    expect(start.body.report).toBeNull();

    const scan = await waitForScan(api, start.body.scanId);
    expect(scan.status).toBe('completed_with_errors'); // /missing.html is broken
    expect(scan.progress).toMatchObject({ discovered: 10, succeeded: 8, failed: 1, skipped: 1, queued: 0, scanning: 0, scanned: 9 });

    const { report } = scan;
    expect(report.url).toBe(`${fixtures.siteOrigin}/`);
    expect(Date.parse(report.finishedAt)).toBeGreaterThanOrEqual(Date.parse(report.startedAt));
    expect(report.totals).toMatchObject({ discoveredPages: 10, succeededPages: 8, failedPages: 1 });
    expect(report.totals.issues).toBe(
      report.pages.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + p.issueCount, 0),
    );
    expect(report.totals.issues).toBeGreaterThan(0);
    expect(report.pages.find((p) => p.url.endsWith('/missing.html')).error.code).toBe('HTTP_ERROR');
    // The home page has an image without alt text, which axe rates critical.
    expect(report.pages.find((p) => p.url === `${fixtures.siteOrigin}/`).worstImpact).toBe('critical');
    expect(report.pages.find((p) => p.url.includes('/deep/1.html')).worstImpact).toBeNull();
    expect(report).not.toHaveProperty('score');
  });

  it('warns when a safety limit stops the scan', async () => {
    const api = buildApp({ env: { SCAN_MAX_PAGES: '3' } });
    const start = await api.post('/api/scans').send({ url: `${fixtures.siteOrigin}/` });
    const scan = await waitForScan(api, start.body.scanId);
    expect(scan.progress.discovered).toBe(3);
    expect(scan.limitsReached).toEqual([{ type: 'maxPages', message: expect.stringContaining('3-page limit') }]);
    expect(scan.report.limitsReached).toHaveLength(1);
  });

  it('fails without a report when the first page cannot be scanned (US-06 AC-4, AC-5)', async () => {
    const api = buildApp({
      scanPage: async ({ url }) => ({
        url,
        finalUrl: url,
        status: 'failed',
        issueCount: 0,
        violations: [],
        links: [],
        error: { code: 'NAVIGATION_FAILED', message: 'The page could not be loaded in the scanning browser.' },
      }),
    });
    const start = await api.post('/api/scans').send({ url: `${fixtures.siteOrigin}/` });
    const scan = await waitForScan(api, start.body.scanId);
    expect(scan.status).toBe('failed');
    expect(scan.error.code).toBe('NAVIGATION_FAILED');
    expect(scan.report).toBeNull();
    expect(scan.pages).toEqual([]);
  });

  it('returns 404 for unknown or malformed scan IDs', async () => {
    const api = buildApp();
    const missing = await api.get('/api/scans/00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('SCAN_NOT_FOUND');
    const malformed = await api.get('/api/scans/../../etc/passwd');
    expect(malformed.status).toBe(404);
  });

  it('refuses new scans when the scanner is busy', async () => {
    const api = buildApp({ env: { MAX_ACTIVE_SCANS: '1' } });
    const first = await api.post('/api/scans').send({ url: `${fixtures.siteOrigin}/` });
    expect(first.status).toBe(202);
    const second = await api.post('/api/scans').send({ url: `${fixtures.siteOrigin}/` });
    expect(second.status).toBe(503);
    expect(second.body.error.code).toBe('SCANNER_BUSY');
    await waitForScan(api, first.body.scanId);
  });
});

describe('unknown routes', () => {
  it('answer with a JSON 404', async () => {
    const res = await buildApp().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});