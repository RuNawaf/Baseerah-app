import { describe, expect, it } from 'vitest';
import { AppError, toPublicError } from '../../src/errors/AppError.js';
import { ERROR_CODES } from '../../src/errors/errorCodes.js';
import { mapNavigationError } from '../../src/scanner/pageScanner.js';

describe('error mapping (US-03, US-06 AC-6)', () => {
  it('gives every error code a status and a user-facing message', () => {
    for (const [code, { status, message }] of Object.entries(ERROR_CODES)) {
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(message.length, code).toBeGreaterThan(10);
    }
  });

  it('exposes only code and message', () => {
    const err = new AppError('TIMEOUT', { cause: new Error('secret internal detail') });
    expect(toPublicError(err)).toEqual({ code: 'TIMEOUT', message: ERROR_CODES.TIMEOUT.message });
    expect(JSON.stringify(err)).not.toContain('secret');
  });

  it('hides the message and stack of unexpected errors', () => {
    const publicError = toPublicError(new Error('ECONNREFUSED 10.1.2.3:5432 password=hunter2'));
    expect(publicError.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(publicError)).not.toMatch(/hunter2|10\.1\.2\.3|at /);
  });

  it('falls back to INTERNAL_ERROR for unknown codes', () => {
    expect(new AppError('NOPE').code).toBe('INTERNAL_ERROR');
  });

  it.each([
    [Object.assign(new Error('Timeout 15000ms exceeded'), { name: 'TimeoutError' }), 'TIMEOUT'],
    [new Error('page.goto: net::ERR_NAME_NOT_RESOLVED at https://x.test'), 'DNS_NOT_FOUND'],
    [new Error('page.goto: net::ERR_CONNECTION_REFUSED'), 'UNREACHABLE'],
    [new Error('page.goto: net::ERR_CERT_DATE_INVALID'), 'UNREACHABLE'],
    [new Error('page.goto: net::ERR_BLOCKED_BY_CLIENT'), 'BLOCKED_ADDRESS'],
    [new Error('page.goto: Download is starting'), 'UNSUPPORTED_CONTENT'],
    [new Error('page.goto: net::ERR_TOO_MANY_REDIRECTS'), 'TOO_MANY_REDIRECTS'],
    [new Error('Target page, context or browser has been closed'), 'NAVIGATION_FAILED'],
  ])('maps Playwright error %#', (err, code) => {
    expect(mapNavigationError(err, 15000).code).toBe(code);
  });
});