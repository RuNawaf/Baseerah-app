import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';
import { createScanRateLimiter } from './middleware/rateLimit.js';
import { healthRoutes } from './routes/health.js';
import { scanRoutes } from './routes/scans.js';

export function createApp({ config, logger, scanService }) {
  const app = express();

  app.disable('x-powered-by');
  // Behind Render/Vercel the client IP comes from the first proxy hop; needed for per-IP rate limits.
  app.set('trust proxy', 1);

  app.use(helmet());
  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST'] }));
  }
  app.use(
    pinoHttp({
      logger,
      // Status polling would flood the log; only log polls that fail.
      autoLogging: { ignore: (req) => req.method === 'GET' && req.url.startsWith('/api/scans/') },
      customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRoutes({ config }));
  app.use(
    '/api/scans',
    scanRoutes({ scanService, scanRateLimiter: createScanRateLimiter({ limitPerMinute: config.rateLimitPerMinute }) }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}