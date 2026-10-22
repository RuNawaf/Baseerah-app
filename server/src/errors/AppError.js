import { describeError, ERROR_CODES } from './errorCodes.js';

export class AppError extends Error {
  constructor(code, { message, cause, details } = {}) {
    const known = code in ERROR_CODES ? code : 'INTERNAL_ERROR';
    super(message ?? describeError(known).message, { cause });
    this.name = 'AppError';
    this.code = known;
    this.status = describeError(known).status;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}

/** Public, safe-to-send shape for any thrown value. Unknown errors never leak their message. */
export function toPublicError(error) {
  if (error instanceof AppError) return error.toJSON();
  return { code: 'INTERNAL_ERROR', message: describeError('INTERNAL_ERROR').message };
}