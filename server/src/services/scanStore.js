/**
 * Temporary in-memory storage for scans (Sprint 1 has no database).
 * Finished scans are removed after `ttlMs`; data is lost when the server restarts.
 */
export function createScanStore({ ttlMs, maxEntries = 200, now = Date.now } = {}) {
  const scans = new Map();

  function prune() {
    const cutoff = now() - ttlMs;
    for (const [id, scan] of scans) {
      if (scan.finishedAt && Date.parse(scan.finishedAt) < cutoff) scans.delete(id);
    }
    // Oldest finished scans go first if memory keeps growing.
    while (scans.size > maxEntries) {
      const oldestFinished = [...scans.values()].find((scan) => scan.finishedAt);
      if (!oldestFinished) break;
      scans.delete(oldestFinished.id);
    }
  }

  const timer = setInterval(prune, 60_000);
  timer.unref();

  return {
    add(scan) {
      scans.set(scan.id, scan);
      prune();
    },
    get(id) {
      return scans.get(id);
    },
    get size() {
      return scans.size;
    },
    prune,
    close() {
      clearInterval(timer);
      scans.clear();
    },
  };
}