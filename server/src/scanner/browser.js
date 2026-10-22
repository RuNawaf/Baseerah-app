import { chromium } from 'playwright';

/**
 * One Chromium process is shared by all scans; each page scan gets its own short-lived context.
 * Launch is lazy so the API starts instantly and health checks never wait for a browser.
 */
export function createBrowserManager({ executablePath, logger } = {}) {
  let browserPromise = null;

  async function launch() {
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--disable-dev-shm-usage'],
    });
    browser.on('disconnected', () => {
      logger?.warn('Scanning browser disconnected');
      browserPromise = null;
    });
    return browser;
  }

  return {
    async getBrowser() {
      if (!browserPromise) {
        browserPromise = launch().catch((err) => {
          browserPromise = null;
          throw err;
        });
      }
      return browserPromise;
    },
    async close() {
      if (!browserPromise) return;
      const browser = await browserPromise.catch(() => null);
      browserPromise = null;
      await browser?.close().catch(() => {});
    },
  };
}