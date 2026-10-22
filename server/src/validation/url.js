import { AppError } from '../errors/AppError.js';

export const MAX_URL_LENGTH = 2048;

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

// Extensions of resources that are not HTML pages. Links to them are never crawled.
const NON_HTML_EXTENSIONS = new Set([
  // documents & archives
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv',
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'dmg', 'exe', 'msi', 'apk', 'iso', 'bin', 'deb', 'rpm',
  // images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff', 'heic',
  // audio & video
  'mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a', 'mp4', 'm4v', 'webm', 'mov', 'avi', 'mkv', 'wmv', 'flv',
  // code, styles, data & fonts
  'js', 'mjs', 'cjs', 'css', 'map', 'json', 'xml', 'rss', 'atom', 'yaml', 'yml', 'wasm',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
]);

/**
 * Turns the text a developer typed into a URL that is safe to hand to the scanner.
 * A bare domain such as "example.com" is treated as https://example.com.
 * Throws AppError for empty, malformed, non-http(s) or credential-bearing input.
 */
export function parseScanUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new AppError('EMPTY_URL');
  }

  let text = input.trim();
  if (text.length > MAX_URL_LENGTH) throw new AppError('INVALID_URL');

  // "localhost:3000" also matches the scheme pattern, so only treat it as a scheme when it is not host:port.
  const hasScheme = SCHEME_PATTERN.test(text) && !/^[^/:]+:\d+(\/|$)/.test(text);
  if (!hasScheme) {
    if (text.startsWith('//')) text = text.slice(2);
    text = `https://${text}`;
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new AppError('INVALID_URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('UNSUPPORTED_PROTOCOL');
  }
  if (url.username || url.password) {
    throw new AppError('CREDENTIALS_NOT_ALLOWED');
  }
  if (!isPlausibleHostname(url.hostname)) {
    throw new AppError('INVALID_URL');
  }

  url.hash = '';
  return url;
}

function isPlausibleHostname(hostname) {
  if (!hostname) return false;
  if (hostname.startsWith('[')) return true; // IPv6 literal, already validated by URL
  if (/^[\d.]+$/.test(hostname)) return true; // IPv4 literal, already normalised by URL
  // Require a dot (example.com) unless it is the special name localhost, which SSRF checks handle.
  if (hostname !== 'localhost' && !hostname.includes('.')) return false;
  return hostname.split('.').every((label) => label.length > 0 && label.length <= 63);
}

/**
 * Canonical form used for the crawl queue and visited set, so the same page is never scanned twice:
 * no fragment, no default port, sorted query parameters, and "/" for an empty path.
 */
export function normalizeUrl(input, base) {
  const url = input instanceof URL ? new URL(input.href) : new URL(input, base);
  url.hash = '';
  url.username = '';
  url.password = '';
  url.searchParams.sort();
  // A bare "?" leaves search empty but still shows in href.
  if (url.searchParams.size === 0) url.search = '';
  if (!url.pathname) url.pathname = '/';
  return url.href;
}

export function isHttpUrl(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export function hasNonHtmlExtension(url) {
  const lastSegment = url.pathname.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0) return false;
  return NON_HTML_EXTENSIONS.has(lastSegment.slice(dot + 1).toLowerCase());
}

/**
 * Decides whether a link found on a page should join the crawl queue.
 * Returns the normalized URL, or null when the link must be skipped.
 */
export function toCrawlableUrl(href, { baseUrl, origin }) {
  if (typeof href !== 'string' || href.trim() === '') return null;

  let url;
  try {
    url = new URL(href.trim(), baseUrl);
  } catch {
    return null;
  }

  // mailto:, tel:, javascript:, data:, ftp: ... are not web pages.
  if (!isHttpUrl(url)) return null;
  // External websites and other subdomains/ports are out of bounds.
  if (url.origin !== origin) return null;
  if (hasNonHtmlExtension(url)) return null;

  return normalizeUrl(url);
}