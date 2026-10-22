function intFromEnv(env, name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid value for ${name}: "${raw}" (expected an integer between ${min} and ${max})`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    port: intFromEnv(env, 'PORT', 4000, { max: 65535 }),
    logLevel: env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
    corsOrigins: (env.CORS_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),

    scan: {
      maxPages: intFromEnv(env, 'SCAN_MAX_PAGES', 50, { max: 1000 }),
      maxDepth: intFromEnv(env, 'SCAN_MAX_DEPTH', 5, { min: 0, max: 50 }),
      pageTimeoutMs: intFromEnv(env, 'SCAN_PAGE_TIMEOUT_MS', 15000, { min: 1000, max: 120000 }),
      concurrency: intFromEnv(env, 'SCAN_CONCURRENCY', 3, { max: 10 }),
      maxDurationMs: intFromEnv(env, 'SCAN_MAX_DURATION_MS', 600000, { min: 5000 }),
    },

    validationTimeoutMs: intFromEnv(env, 'VALIDATION_TIMEOUT_MS', 10000, { min: 500, max: 60000 }),
    maxActiveScans: intFromEnv(env, 'MAX_ACTIVE_SCANS', 2, { max: 20 }),
    scanTtlMs: intFromEnv(env, 'SCAN_TTL_MINUTES', 60, { max: 24 * 60 }) * 60 * 1000,
    rateLimitPerMinute: intFromEnv(env, 'RATE_LIMIT_PER_MINUTE', 10, { max: 10000 }),

    chromiumExecutable: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,

    // SSRF protection can only be relaxed outside production, for local fixture sites in tests.
    allowPrivateTargets: !isProduction && env.ALLOW_PRIVATE_NETWORK_TARGETS === 'true',
  };
}