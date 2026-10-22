import { rateLimit } from 'express-rate-limit';
import { AppError } from '../errors/AppError.js';

export function createScanRateLimiter({ limitPerMinute }) {
  return rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError('RATE_LIMITED')),
  });
}