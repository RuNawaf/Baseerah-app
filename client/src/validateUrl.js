// Client-side check that mirrors the server's first validation step, so obvious mistakes
// are caught before a request is sent. The server always validates again.
export const MESSAGES = {
  EMPTY_URL: 'Enter a website URL to scan.',
  INVALID_URL: 'This is not a valid web address. Check the spelling, for example https://www.ksu.edu.sa.',
  UNSUPPORTED_PROTOCOL: 'Only http:// and https:// addresses can be scanned.',
  CREDENTIALS_NOT_ALLOWED: 'Remove the username or password from the address. Baseerah only scans public pages.',
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_PORT = /^[^/:]+:\d+(\/|$)/;

/** Returns { url } on success or { code, message } on failure. */
export function validateUrl(input) {
  const text = (input ?? '').trim();
  if (!text) return { code: 'EMPTY_URL', message: MESSAGES.EMPTY_URL };

  const withScheme = SCHEME.test(text) && !HOST_PORT.test(text) ? text : `https://${text.replace(/^\/\//, '')}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return { code: 'INVALID_URL', message: MESSAGES.INVALID_URL };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { code: 'UNSUPPORTED_PROTOCOL', message: MESSAGES.UNSUPPORTED_PROTOCOL };
  }
  if (url.username || url.password) {
    return { code: 'CREDENTIALS_NOT_ALLOWED', message: MESSAGES.CREDENTIALS_NOT_ALLOWED };
  }
  const host = url.hostname;
  const plausible = host.startsWith('[') || /^[\d.]+$/.test(host) || host === 'localhost' || (host.includes('.') && !host.split('.').some((l) => !l));
  if (!plausible) return { code: 'INVALID_URL', message: MESSAGES.INVALID_URL };

  return { url: url.href };
}