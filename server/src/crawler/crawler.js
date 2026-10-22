import { normalizeUrl, toCrawlableUrl } from '../validation/url.js';

export const PAGE_STATUS = {
  QUEUED: 'queued',
  SCANNING: 'scanning',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export function describeLimit(type, limits) {
  switch (type) {
    case 'maxPages':
      return `The scan stopped at the ${limits.maxPages}-page limit, so some pages on this website were not scanned.`;
    case 'maxDepth':
      return `Some pages are more than ${limits.maxDepth} links away from the start page and were not scanned.`;
    case 'maxDuration':
      return `The scan reached its ${Math.round(limits.maxDurationMs / 60000)}-minute time limit, so pages still waiting in the queue were not scanned.`;
    default:
      return 'The scan stopped because a safety limit was reached.';
  }
}

/**
 * Breadth-first crawl of one website (same origin only).
 *
 * - The queue holds { url, depth }; the visited set holds normalized URLs and is filled when a URL is
 *   queued, not when it is scanned, so a page linked from many places is queued exactly once.
 * - `onChange(pages)` receives the current page list whenever a page changes state.
 * - `scanPage(url)` does the actual loading and checking and must resolve, never reject, with
 *   { status, finalUrl, links, ... }.
 * - Up to `concurrency` pages are scanned at the same time. The first page runs alone because
 *   the queue only has one entry until it finishes.
 */
export async function crawlWebsite({ startUrl, origin, limits, scanPage, onChange = () => {}, logger, now = Date.now }) {
  const start = normalizeUrl(startUrl);
  const deadline = now() + limits.maxDurationMs;

  const pages = new Map();
  const visited = new Set([start]);
  const scannedFinalUrls = new Map(); // final URL after redirects -> page that was scanned there
  const limitsReached = new Set();
  const queue = [{ url: start, depth: 0 }];

  const notify = () => onChange([...pages.values()]);

  pages.set(start, { url: start, depth: 0, status: PAGE_STATUS.QUEUED });
  notify();

  function enqueueLinks(links, fromPage) {
    const nextDepth = fromPage.depth + 1;
    for (const href of links) {
      const url = toCrawlableUrl(href, { baseUrl: fromPage.finalUrl, origin });
      if (!url || visited.has(url)) continue;
      if (nextDepth > limits.maxDepth) {
        limitsReached.add('maxDepth');
        continue;
      }
      if (visited.size >= limits.maxPages) {
        limitsReached.add('maxPages');
        continue;
      }
      visited.add(url);
      queue.push({ url, depth: nextDepth });
      pages.set(url, { url, depth: nextDepth, status: PAGE_STATUS.QUEUED });
    }
  }

  async function processPage({ url, depth }) {
    const page = pages.get(url);
    page.status = PAGE_STATUS.SCANNING;
    notify();

    const result = await scanPage(url);
    Object.assign(page, result, { url, depth });
    delete page.links;

    if (result.status === PAGE_STATUS.SUCCEEDED) {
      const finalUrl = normalizeUrl(result.finalUrl);
      const firstSeenAt = scannedFinalUrls.get(finalUrl);
      if (firstSeenAt && firstSeenAt !== url) {
        // Two queued URLs redirected to the same page; keep only the first result.
        Object.assign(page, {
          status: PAGE_STATUS.SKIPPED,
          issueCount: 0,
          violations: [],
          note: `Redirects to a page that was already scanned (${firstSeenAt}).`,
        });
      } else {
        scannedFinalUrls.set(finalUrl, url);
        visited.add(finalUrl);
        enqueueLinks(result.links ?? [], { depth, finalUrl: result.finalUrl });
      }
    } else if (result.links?.length) {
      // The page loaded but could not be analysed; its links are still worth following.
      enqueueLinks(result.links, { depth, finalUrl: result.finalUrl });
    }
    notify();
  }

  await new Promise((resolve) => {
    let active = 0;

    const pump = () => {
      if (queue.length && now() >= deadline) {
        limitsReached.add('maxDuration');
        for (const { url } of queue.splice(0)) {
          Object.assign(pages.get(url), { status: PAGE_STATUS.SKIPPED, note: 'Not scanned: the scan time limit was reached.' });
        }
        notify();
      }
      while (active < limits.concurrency && queue.length) {
        const item = queue.shift();
        active += 1;
        processPage(item)
          .catch((err) => {
            // scanPage should never reject; this keeps one unexpected bug from stopping the crawl.
            Object.assign(pages.get(item.url), {
              status: PAGE_STATUS.FAILED,
              error: { code: 'SCAN_FAILED', message: 'The scan could not be completed because of an unexpected scanner error.' },
            });
            logger?.error({ err, url: item.url }, 'Unexpected error while scanning a page');
          })
          .finally(() => {
            active -= 1;
            pump();
          });
      }
      if (active === 0 && queue.length === 0) resolve();
    };

    pump();
  });

  return {
    pages: [...pages.values()],
    startPage: pages.get(start),
    limitsReached: [...limitsReached].map((type) => ({ type, message: describeLimit(type, limits) })),
  };
}