import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import { AppError } from '../errors/AppError.js';
import { crawlWebsite, PAGE_STATUS } from '../crawler/crawler.js';
import { scanPage as defaultScanPage } from '../scanner/pageScanner.js';
import { assertPublicHost, checkReachability as defaultCheckReachability } from '../validation/network.js';
import { normalizeUrl, parseScanUrl } from '../validation/url.js';
import { createScanStore } from './scanStore.js';

export const SCAN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  FAILED: 'failed',
};

const FINISHED = new Set([SCAN_STATUS.COMPLETED, SCAN_STATUS.COMPLETED_WITH_ERRORS, SCAN_STATUS.FAILED]);

function countPages(pages) {
  const counts = { discovered: pages.length, queued: 0, scanning: 0, succeeded: 0, failed: 0, skipped: 0 };
  for (const page of pages) counts[page.status] += 1;
  counts.scanned = counts.succeeded + counts.failed;
  return counts;
}

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

function worstImpact(violations = []) {
  return IMPACT_ORDER.find((impact) => violations.some((violation) => violation.impact === impact)) ?? null;
}

function publicPage(page, { withViolations }) {
  const view = {
    url: page.url,
    finalUrl: page.finalUrl ?? page.url,
    depth: page.depth,
    status: page.status,
    httpStatus: page.httpStatus ?? null,
    issueCount: page.issueCount ?? 0,
    durationMs: page.durationMs ?? null,
    error: page.error ?? null,
    note: page.note ?? null,
    worstImpact: page.status === PAGE_STATUS.SUCCEEDED ? worstImpact(page.violations) : null,
  };
  if (withViolations) view.violations = page.violations ?? [];
  return view;
}

/** The JSON returned by GET /api/scans/:id. A report is only included for scans that produced results. */
export function toPublicScan(scan) {
  const pages = scan.pages ?? [];
  const finished = FINISHED.has(scan.status);
  const hasReport = scan.status === SCAN_STATUS.COMPLETED || scan.status === SCAN_STATUS.COMPLETED_WITH_ERRORS;
  const progress = countPages(pages);

  return {
    scanId: scan.id,
    status: scan.status,
    url: scan.url,
    siteOrigin: scan.origin,
    createdAt: scan.createdAt,
    startedAt: scan.startedAt,
    finishedAt: scan.finishedAt,
    limits: scan.limits,
    progress,
    limitsReached: scan.limitsReached,
    error: scan.error,
    // Live page list for the progress view; a failed scan shows no page results at all.
    pages: scan.status === SCAN_STATUS.FAILED ? [] : pages.map((page) => publicPage(page, { withViolations: false })),
    report:
      finished && hasReport
        ? {
            url: scan.url,
            startedAt: scan.startedAt,
            finishedAt: scan.finishedAt,
            totals: {
              discoveredPages: progress.discovered,
              succeededPages: progress.succeeded,
              failedPages: progress.failed,
              skippedPages: progress.skipped,
              issues: pages.reduce((sum, page) => sum + (page.status === PAGE_STATUS.SUCCEEDED ? page.issueCount : 0), 0),
            },
            limitsReached: scan.limitsReached,
            pages: pages.map((page) => publicPage(page, { withViolations: true })),
          }
        : null,
  };
}

export function createScanService({
  config,
  logger,
  browserManager,
  scanPage = defaultScanPage,
  checkReachability = defaultCheckReachability,
  lookup = dns.lookup,
}) {
  const store = createScanStore({ ttlMs: config.scanTtlMs });
  let activeScans = 0;

  function makeGuard() {
    // Cache per scan so each host is resolved once, not once per request.
    const checked = new Map();
    return (hostname) => {
      if (!checked.has(hostname)) {
        checked.set(hostname, assertPublicHost(hostname, { lookup, allowPrivate: config.allowPrivateTargets }));
      }
      return checked.get(hostname);
    };
  }

  async function runScan(scan) {
    const log = logger.child({ scanId: scan.id });
    scan.status = SCAN_STATUS.RUNNING;
    scan.startedAt = new Date().toISOString();
    log.info({ origin: scan.origin, limits: scan.limits }, 'Scan started');

    try {
      const browser = await browserManager.getBrowser();
      const guardHost = makeGuard();

      const result = await crawlWebsite({
        startUrl: scan.startUrl,
        origin: scan.origin,
        limits: scan.limits,
        logger: log,
        scanPage: (url) =>
          scanPage({ browser, url, origin: scan.origin, timeoutMs: scan.limits.pageTimeoutMs, guardHost }),
        onChange: (pages) => {
          scan.pages = pages;
        },
      });

      scan.pages = result.pages;
      scan.limitsReached = result.limitsReached;

      if (result.startPage.status === PAGE_STATUS.FAILED) {
        // Nothing could be scanned, so there is no report (US-06 AC-4/AC-5).
        scan.status = SCAN_STATUS.FAILED;
        scan.error = result.startPage.error ?? new AppError('SCAN_FAILED').toJSON();
      } else {
        const anyFailed = result.pages.some((page) => page.status === PAGE_STATUS.FAILED);
        scan.status = anyFailed ? SCAN_STATUS.COMPLETED_WITH_ERRORS : SCAN_STATUS.COMPLETED;
      }
    } catch (err) {
      log.error({ err }, 'Scan crashed');
      scan.status = SCAN_STATUS.FAILED;
      scan.error = new AppError('SCAN_FAILED').toJSON();
    } finally {
      scan.finishedAt = new Date().toISOString();
      activeScans -= 1;
      const counts = countPages(scan.pages);
      log.info({ status: scan.status, ...counts, errorCode: scan.error?.code }, 'Scan finished');
    }
  }

  return {
    /**
     * Validates the URL (format, SSRF, reachability) and starts the crawl in the background.
     * Validation errors are thrown so the API can answer immediately; nothing is stored for them.
     */
    async startScan(rawUrl) {
      const url = parseScanUrl(rawUrl);

      if (activeScans >= config.maxActiveScans) throw new AppError('SCANNER_BUSY');
      activeScans += 1;

      let reachable;
      try {
        await assertPublicHost(url.hostname, { lookup, allowPrivate: config.allowPrivateTargets });
        reachable = await checkReachability(url.href, {
          timeoutMs: config.validationTimeoutMs,
          allowPrivate: config.allowPrivateTargets,
          lookup,
        });
      } catch (err) {
        activeScans -= 1;
        throw err;
      }

      const startUrl = normalizeUrl(reachable.finalUrl);
      const scan = {
        id: randomUUID(),
        status: SCAN_STATUS.QUEUED,
        url: normalizeUrl(url),
        startUrl,
        origin: new URL(startUrl).origin,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        limits: { ...config.scan },
        limitsReached: [],
        error: null,
        pages: [],
      };
      store.add(scan);

      // Respond with the scan ID first; the crawl runs in the background and polling sees live progress.
      queueMicrotask(() => runScan(scan));

      return toPublicScan(scan);
    },

    getScan(id) {
      const scan = store.get(id);
      if (!scan) throw new AppError('SCAN_NOT_FOUND');
      return toPublicScan(scan);
    },

    async close() {
      store.close();
      await browserManager.close();
    },
  };
}