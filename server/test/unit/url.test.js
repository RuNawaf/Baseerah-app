import { describe, expect, it } from 'vitest';
import { hasNonHtmlExtension, normalizeUrl, parseScanUrl, toCrawlableUrl } from '../../src/validation/url.js';

function codeOf(fn) {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return null;
}

describe('parseScanUrl (US-01, US-02)', () => {
  it('accepts http and https URLs', () => {
    expect(parseScanUrl('https://example.com/a').href).toBe('https://example.com/a');
    expect(parseScanUrl('http://example.com').href).toBe('http://example.com/');
  });

  it('adds https:// to a bare domain and trims spaces', () => {
    expect(parseScanUrl('  example.com/path ').href).toBe('https://example.com/path');
    expect(parseScanUrl('localhost:3000').href).toBe('https://localhost:3000/');
  });

  it('removes the fragment', () => {
    expect(parseScanUrl('https://example.com/page#section').href).toBe('https://example.com/page');
  });

  it.each([
    ['', 'EMPTY_URL'],
    ['   ', 'EMPTY_URL'],
    [undefined, 'EMPTY_URL'],
    ['https://', 'INVALID_URL'],
    ['http://exa mple.com', 'INVALID_URL'],
    ['not a url', 'INVALID_URL'],
    ['https://nodot', 'INVALID_URL'],
    ['https://example..com', 'INVALID_URL'],
    [`https://example.com/${'a'.repeat(3000)}`, 'INVALID_URL'],
  ])('rejects %j with %s', (input, code) => {
    expect(codeOf(() => parseScanUrl(input))).toBe(code);
  });

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'mailto:a@b.com', 'data:text/html,hi', 'ws://example.com'])(
    'rejects unsupported protocol %s',
    (input) => {
      expect(codeOf(() => parseScanUrl(input))).toBe('UNSUPPORTED_PROTOCOL');
    },
  );

  it('rejects URLs with credentials', () => {
    expect(codeOf(() => parseScanUrl('https://user:pass@example.com'))).toBe('CREDENTIALS_NOT_ALLOWED');
  });
});

describe('normalizeUrl (US-04 AC-6)', () => {
  it.each([
    ['HTTPS://Example.COM', 'https://example.com/'],
    ['https://example.com:443/a', 'https://example.com/a'],
    ['http://example.com:80/a', 'http://example.com/a'],
    ['https://example.com/a#b', 'https://example.com/a'],
    ['https://example.com/a?b=2&a=1', 'https://example.com/a?a=1&b=2'],
    ['https://example.com/a?', 'https://example.com/a'],
    ['https://example.com/a/../b', 'https://example.com/b'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it('resolves relative links against a base', () => {
    expect(normalizeUrl('../x.html#top', 'https://example.com/a/b/c.html')).toBe('https://example.com/a/x.html');
  });
});

describe('toCrawlableUrl (US-04 AC-3, AC-4)', () => {
  const ctx = { baseUrl: 'https://example.com/blog/', origin: 'https://example.com' };

  it('keeps internal HTML links, normalized', () => {
    expect(toCrawlableUrl('post.html#comments', ctx)).toBe('https://example.com/blog/post.html');
    expect(toCrawlableUrl('/about', ctx)).toBe('https://example.com/about');
  });

  it.each([
    'https://other.com/',
    'https://sub.example.com/',
    'http://example.com/', // different scheme = different origin
    'https://example.com:8443/',
    'mailto:hi@example.com',
    'tel:+123',
    'javascript:void(0)',
    'ftp://example.com/file',
    'data:text/html,hello',
    '/report.pdf',
    '/photo.JPG',
    '/movie.mp4',
    '/app.js',
    '/style.css',
    '/feed.xml',
    '/archive.zip',
    '',
  ])('skips %j', (href) => {
    expect(toCrawlableUrl(href, ctx)).toBeNull();
  });

  it('does not treat dotted directory names as files', () => {
    expect(hasNonHtmlExtension(new URL('https://example.com/v1.2/docs'))).toBe(false);
    expect(hasNonHtmlExtension(new URL('https://example.com/page.html'))).toBe(false);
    expect(hasNonHtmlExtension(new URL('https://example.com/page.php'))).toBe(false);
  });
});