import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createBrowserManager } from './scanner/browser.js';
import { createScanService } from './services/scanService.js';

// Optional .env in the repository root; real environment variables take precedence.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const logger = createLogger(config.logLevel);

if (config.allowPrivateTargets) {
  logger.warn('ALLOW_PRIVATE_NETWORK_TARGETS is on: SSRF protection is disabled. Use this for local tests only.');
}

const browserManager = createBrowserManager({ executablePath: config.chromiumExecutable, logger });
const scanService = createScanService({ config, logger, browserManager });
const app = createApp({ config, logger, scanService });

// Express 5 passes listen errors (such as a busy port) to this callback instead of throwing.
const server = app.listen(config.port, (err) => {
  if (err) {
    if (err.code === 'EADDRINUSE') {
      logger.fatal(
        `Port ${config.port} is already in use. Another Baseerah server is probably still running: stop it, or set PORT to a different value.`,
      );
    } else {
      logger.fatal({ err }, 'Server failed to start');
    }
    process.exit(1);
  }
  logger.info({ port: config.port, limits: config.scan }, 'Baseerah API listening');
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await scanService.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);