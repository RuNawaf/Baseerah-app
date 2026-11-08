import { vi } from 'vitest';

export const SITE = 'https://bakery.example';

export const HEALTH_LIMITS = { maxPages: 50, maxDepth: 5, pageTimeoutMs: 15000, concurrency: 3, maxDurationMs: 600000 };

export function jsonResponse(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

export function page(path, status, extra = {}) {
  return { url: `${SITE}${path}`, finalUrl: `${SITE}${path}`, depth: 0, status, issueCount: 0, error: null, note: null, ...extra };
}

export function scanState(status, { pages = [], report = null, error = null } = {}) {
  const counts = { discovered: pages.length, queued: 0, scanning: 0, succeeded: 0, failed: 0, skipped: 0 };
  for (const p of pages) counts[p.status] += 1;
  counts.scanned = counts.succeeded + counts.failed;
  return {
    scanId: '11111111-1111-4111-8111-111111111111',
    status,
    url: `${SITE}/`,
    startedAt: '2026-10-21T10:00:00.000Z',
    finishedAt: report ? '2026-10-21T10:00:42.000Z' : null,
    progress: counts,
    limitsReached: [],
    error,
    pages: status === 'failed' ? [] : pages,
    report,
  };
}

export const completedReport = {
  url: `${SITE}/`,
  startedAt: '2026-10-21T10:00:00.000Z',
  finishedAt: '2026-10-21T10:00:42.000Z',
  totals: { discoveredPages: 3, succeededPages: 2, failedPages: 1, skippedPages: 0, issues: 4 },
  limitsReached: [],
  pages: [
    page('/', 'succeeded', {
      issueCount: 3,
      worstImpact: 'critical',
      violations: [
        {
          id: 'image-alt',
          impact: 'critical',
          help: 'Images must have alternative text',
          description: 'Ensures <img> elements have alternative text or a role of none or presentation',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
          category: 'altText',
          wcag: ['wcag2a', 'wcag111'],
          nodeCount: 3,
          nodes: [
            {
              target: 'img.logo',
              html: '<img src="logo.png" class="logo">',
              failureSummary: 'Fix any of the following…',
              suggestion: {
                text: 'Bakery logo',
                basis: 'fileName',
                attribute: 'alt',
                code: '<img alt="Bakery logo" src="logo.png" class="logo">',
              },
            },
          ],
        },
      ],
    }),
    page('/about.html', 'succeeded', {
      issueCount: 1,
      worstImpact: 'serious',
      violations: [
        {
          id: 'label',
          impact: 'serious',
          help: 'Form elements must have labels',
          description: 'Ensures every form element has a label',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/label',
          category: 'label',
          wcag: ['wcag2a'],
          nodeCount: 1,
          nodes: [
            {
              target: 'input[name="email"]',
              html: '<input type="email" name="email">',
              failureSummary: '',
              suggestion: {
                text: 'Email address',
                basis: 'inputType',
                kind: 'label',
                code: '<label for="email">Email address</label>\n<input id="email" type="email" name="email">',
              },
            },
          ],
        },
      ],
    }),
    page('/missing.html', 'failed', {
      error: { code: 'HTTP_ERROR', message: 'The page responded with HTTP 404.' },
      violations: [],
    }),
  ],
};

/**
 * Replaces fetch. `post` answers POST /api/scans; `polls` are returned in order for GET /api/scans/:id
 * (the last one repeats).
 */
export function mockApi({ post, polls = [] }) {
  let pollIndex = 0;
  const fetchMock = vi.fn((url, options = {}) => {
    if (url === '/api/health') return jsonResponse(200, { status: 'ok', limits: HEALTH_LIMITS });
    if (options.method === 'POST') return typeof post === 'function' ? post() : jsonResponse(...post);
    const next = polls[Math.min(pollIndex, polls.length - 1)];
    pollIndex += 1;
    return typeof next === 'function' ? next() : jsonResponse(200, next);
  });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.scanCalls = () => fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/scans'));
  return fetchMock;
}