import { describe, expect, it } from 'vitest';
import { validateUrl } from '../src/validateUrl.js';

describe('validateUrl (client side, US-02 AC-2)', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    ['example.com', 'https://example.com/'],
    ['  http://example.com/a  ', 'http://example.com/a'],
  ])('accepts %s', (input, url) => {
    expect(validateUrl(input)).toEqual({ url });
  });

  it.each([
    ['', 'EMPTY_URL'],
    ['   ', 'EMPTY_URL'],
    ['ftp://example.com', 'UNSUPPORTED_PROTOCOL'],
    ['mailto:a@b.co', 'UNSUPPORTED_PROTOCOL'],
    ['http://exa mple.com', 'INVALID_URL'],
    ['nodot', 'INVALID_URL'],
    ['https://a:b@example.com', 'CREDENTIALS_NOT_ALLOWED'],
  ])('rejects %j as %s', (input, code) => {
    expect(validateUrl(input).code).toBe(code);
  });
});