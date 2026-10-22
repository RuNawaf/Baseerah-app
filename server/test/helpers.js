import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';

export const logger = createLogger('silent');

export function testConfig(env = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    ALLOW_PRIVATE_NETWORK_TARGETS: 'true',
    PLAYWRIGHT_CHROMIUM_EXECUTABLE: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '',
    SCAN_PAGE_TIMEOUT_MS: '8000',
    VALIDATION_TIMEOUT_MS: '3000',
    RATE_LIMIT_PER_MINUTE: '1000',
    ...env,
  });
}

/** Polls GET /api/scans/:id until the scan finishes. */
export async function waitForScan(agent, scanId, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await agent.get(`/api/scans/${scanId}`);
    if (['completed', 'completed_with_errors', 'failed'].includes(res.body.status)) return res.body;
    if (Date.now() > deadline) throw new Error(`Scan ${scanId} did not finish: ${JSON.stringify(res.body.progress)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** dns.lookup stand-in so tests never depend on real DNS. */
export function fakeLookup(table) {
  return (hostname, options, callback) => {
    const entry = table[hostname];
    if (!entry) {
      const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      err.code = 'ENOTFOUND';
      return callback(err);
    }
    const addresses = entry.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    if (options?.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  };
}