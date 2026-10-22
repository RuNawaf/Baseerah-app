import { AppError, toPublicError } from './AppError.js';

export function notFoundHandler(req, res, next) {
  next(new AppError('NOT_FOUND'));
}

// Express recognises error middleware by its four parameters, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  // Errors raised by express.json() for bad bodies.
  if (err?.type === 'entity.too.large') error = new AppError('PAYLOAD_TOO_LARGE');
  else if (err?.type === 'entity.parse.failed') error = new AppError('INVALID_REQUEST');

  if (!(error instanceof AppError)) {
    req.log?.error({ err }, 'Unhandled error');
  }

  const status = error instanceof AppError ? error.status : 500;
  res.status(status).json({ error: toPublicError(error) });
}