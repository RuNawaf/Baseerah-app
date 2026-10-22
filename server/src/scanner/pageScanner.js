import AxeBuilder from '@axe-core/playwright';
import { AppError } from '../errors/AppError.js';
import { USER_AGENT } from '../validation/network.js';

const MAX_NODES_PER_RULE = 10;
const SETTLE_TIMEOUT_MS = 3000;

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Converts Playwright navigation errors into the public error codes. */
export function mapNavigationError(err, timeoutMs) {
  if (err instanceof AppError) return err;
  const message = String(err?.message ?? '');

  if (err?.name === 'TimeoutError' || message.includes('Timeout')) {
    return new AppError('TIMEOUT', {
      message: `The page did not finish loading within ${Math.round(timeoutMs / 1000)} seconds.`,
    });
  }
  if (message.includes('ERR_BLOCKED_BY_CLIENT')) return new AppError('BLOCKED_ADDRESS');
  if (message.includes('ERR_NAME_NOT_RESOLVED')) return new AppError('DNS_NOT_FOUND');
  if (message.includes('Download is starting')) return new AppError('UNSUPPORTED_CONTENT');
  if (/ERR_(CONNECTION|ADDRESS|NETWORK|INTERNET|SSL|CERT|EMPTY_RESPONSE|TUNNEL)/.test(message)) {
    return new AppError('UNREACHABLE');
  }
  if (message.includes('ERR_TOO_MANY_REDIRECTS')) return new AppError('TOO_MANY_REDIRECTS');
  return new AppError('NAVIGATION_FAILED');
}

function summarizeViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    description: violation.description,
    helpUrl: violation.helpUrl,
    wcag: violation.tags.filter((tag) => /^wcag\d/.test(tag)),
    nodeCount: violation.nodes.length,
    nodes: violation.nodes.slice(0, MAX_NODES_PER_RULE).map((node) => ({
      target: node.target.map(String).join(' '),
      html: truncate(node.html, 300),
      failureSummary: truncate(node.failureSummary, 500),
    })),
  }));
}

/**
 * Every request the scanning browser starts (pages, iframes, scripts, fetch/XHR) goes through this guard,
 * and requests to internal addresses are aborted (SSRF protection).
 * Playwright does not route the individual hops of an HTTP redirect, so a final URL that lands
 * outside the website is rejected after navigation instead (see REDIRECTED_EXTERNAL).
 */
async function installRequestGuard(context, guardHost) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    let url;
    try {
      url = new URL(request.url());
    } catch {
      return route.abort('blockedbyclient');
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.abort('blockedbyclient');
    // Audio and video never affect the checks and can be huge.
    if (request.resourceType() === 'media') return route.abort('blockedbyclient');

    try {
      await guardHost(url.hostname);
    } catch {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}

/**
 * Loads one page and runs axe-core on it. It only navigates and reads the page:
 * no clicks, no form submissions, no downloads.
 *
 * Resolves to { status: 'succeeded' | 'failed', ... } and never throws for page-level problems,
 * so one broken page cannot stop the website scan.
 */
export async function scanPage({ browser, url, origin, timeoutMs, guardHost }) {
  const startedAt = Date.now();
  const result = {
    url,
    finalUrl: url,
    httpStatus: null,
    status: 'failed',
    issueCount: 0,
    violations: [],
    links: [],
    error: null,
    durationMs: 0,
  };

  let context;
  // Hard stop in case a page hangs somewhere Playwright's own timeouts do not cover.
  let hardTimer;
  const hardTimeout = new Promise((_, reject) => {
    hardTimer = setTimeout(
      () => reject(new AppError('TIMEOUT', { message: `The page did not finish loading within ${Math.round(timeoutMs / 1000)} seconds.` })),
      timeoutMs * 3,
    );
  });

  const work = (async () => {
    context = await browser.newContext({
      userAgent: USER_AGENT,
      acceptDownloads: false,
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 900 },
    });
    context.setDefaultTimeout(timeoutMs);
    context.setDefaultNavigationTimeout(timeoutMs);
    await installRequestGuard(context, guardHost);

    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));

    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    } catch (err) {
      throw mapNavigationError(err, timeoutMs);
    }
    if (!response) throw new AppError('NAVIGATION_FAILED');

    result.httpStatus = response.status();
    result.finalUrl = page.url();

    if (response.status() >= 400) {
      throw new AppError('HTTP_ERROR', { message: `The page responded with HTTP ${response.status()}.` });
    }
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new AppError('UNSUPPORTED_CONTENT');
    }
    if (new URL(result.finalUrl).origin !== origin) {
      throw new AppError('REDIRECTED_EXTERNAL');
    }

    // Give client-rendered pages a moment to finish; not fatal if the network never goes idle.
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});

    result.links = await page
      .$$eval('a[href], area[href]', (elements) =>
        elements.filter((element) => !element.hasAttribute('download')).map((element) => element.href),
      )
      .catch(() => []);

    let axeResults;
    try {
      axeResults = await new AxeBuilder({ page }).analyze();
    } catch (err) {
      throw new AppError('ANALYSIS_FAILED', { cause: err });
    }

    result.violations = summarizeViolations(axeResults.violations);
    result.issueCount = result.violations.reduce((sum, violation) => sum + violation.nodeCount, 0);
    result.status = 'succeeded';
  })();

  try {
    await Promise.race([work, hardTimeout]);
  } catch (err) {
    const error = err instanceof AppError ? err : mapNavigationError(err, timeoutMs);
    result.status = 'failed';
    result.error = error.toJSON();
    result.violations = [];
    result.issueCount = 0;
  } finally {
    clearTimeout(hardTimer);
    work.catch(() => {});
    await context?.close().catch(() => {});
    result.durationMs = Date.now() - startedAt;
  }

  return result;
}