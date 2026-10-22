import dns from 'node:dns';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';
import { AppError } from '../errors/AppError.js';
import { parseScanUrl } from './url.js';

export const USER_AGENT = 'BaseerahBot/0.1 (+web accessibility scanner; SWE 444 student project)';
const MAX_REDIRECTS = 5;

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan'];

/** True for any address that is not public internet unicast: loopback, private, link-local, CGNAT, multicast… */
export function isBlockedIp(address) {
  if (!ipaddr.isValid(address)) return true;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }
  return parsed.range() !== 'unicast';
}

export function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function stripBrackets(hostname) {
  return hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
}

function lookupAll(lookup, hostname) {
  return new Promise((resolve, reject) => {
    lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

/**
 * Resolves the host of a URL and throws BLOCKED_ADDRESS if any of its addresses are internal.
 * Checking every resolved address stops "public name, private IP" tricks.
 */
export async function assertPublicHost(hostname, { lookup = dns.lookup, allowPrivate = false } = {}) {
  if (allowPrivate) return;
  const host = stripBrackets(hostname);

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new AppError('BLOCKED_ADDRESS');
    return;
  }
  if (isBlockedHostname(host)) throw new AppError('BLOCKED_ADDRESS');

  let addresses;
  try {
    addresses = await lookupAll(lookup, host);
  } catch (err) {
    throw mapNetworkError(err);
  }
  if (!addresses.length) throw new AppError('DNS_NOT_FOUND');
  if (addresses.some(({ address }) => isBlockedIp(address))) {
    throw new AppError('BLOCKED_ADDRESS');
  }
}

/**
 * A dns.lookup replacement for undici that refuses internal addresses at connect time.
 * Because the check happens on the address actually used for the connection,
 * DNS rebinding between validation and fetching cannot reach the internal network.
 */
export function createSafeLookup({ lookup = dns.lookup, allowPrivate = false } = {}) {
  return function safeLookup(hostname, options, callback) {
    lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      if (!allowPrivate && addresses.some(({ address }) => isBlockedIp(address))) {
        return callback(new AppError('BLOCKED_ADDRESS'));
      }
      if (options?.all) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

/** Maps low-level fetch/DNS/socket failures to the public error codes. */
export function mapNetworkError(err) {
  if (err instanceof AppError) return err;
  if (err?.cause instanceof AppError) return err.cause;

  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return new AppError('TIMEOUT', { cause: err });

  const code = err?.code ?? err?.cause?.code ?? err?.cause?.cause?.code;
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
    case 'EAI_NONAME':
    case 'ENODATA':
      return new AppError('DNS_NOT_FOUND', { cause: err });
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'UND_ERR_HEADERS_TIMEOUT':
    case 'UND_ERR_BODY_TIMEOUT':
    case 'ETIMEDOUT':
      return new AppError('TIMEOUT', { cause: err });
    default:
      return new AppError('UNREACHABLE', { cause: err });
  }
}

function isHtmlContentType(contentType) {
  if (!contentType) return true; // many servers omit it; the browser will decide later
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

/**
 * Confirms the website answers before a scan starts (US-02 AC-3).
 * Follows up to five redirects manually so that every hop is re-validated against SSRF rules.
 */
export async function checkReachability(startUrl, { timeoutMs = 10000, allowPrivate = false, lookup = dns.lookup } = {}) {
  const dispatcher = new Agent({
    connect: { lookup: createSafeLookup({ lookup, allowPrivate }), timeout: timeoutMs },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    let current = new URL(startUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHost(current.hostname, { lookup, allowPrivate });

      let response;
      try {
        response = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal,
          dispatcher,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
        });
      } catch (err) {
        throw mapNetworkError(err);
      }
      // Only the headers are needed; do not download the body.
      await response.body?.cancel().catch(() => {});

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        current = parseScanUrl(new URL(location, current).href);
        continue;
      }

      if (response.status >= 400) {
        throw new AppError('HTTP_ERROR', {
          message: `The website responded with HTTP ${response.status}, so it cannot be scanned. Check that the address is correct and the page is public.`,
        });
      }
      if (!isHtmlContentType(response.headers.get('content-type'))) {
        throw new AppError('UNSUPPORTED_CONTENT');
      }
      return { finalUrl: current.href, status: response.status };
    }
    throw new AppError('TOO_MANY_REDIRECTS');
  } finally {
    dispatcher.close().catch(() => {});
  }
}