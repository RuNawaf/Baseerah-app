import { describe, expect, it } from 'vitest';
import {
  assertPublicHost,
  createSafeLookup,
  isBlockedHostname,
  isBlockedIp,
  mapNetworkError,
} from '../../src/validation/network.js';
import { fakeLookup } from '../helpers.js';

async function codeOf(promise) {
  try {
    await promise;
  } catch (err) {
    return err.code;
  }
  return null;
}

describe('isBlockedIp (US-02 AC-5)', () => {
  it.each([
    '127.0.0.1',
    '127.255.0.9',
    '10.0.0.5',
    '172.16.3.4',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // carrier-grade NAT
    '0.0.0.0',
    '255.255.255.255',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '93.184.216.34', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows public %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe('isBlockedHostname', () => {
  it.each(['localhost', 'LOCALHOST', 'app.localhost', 'printer.local', 'db.internal', 'router.home.arpa', 'localhost.'])(
    'blocks %s',
    (host) => expect(isBlockedHostname(host)).toBe(true),
  );
  it('allows normal domains', () => expect(isBlockedHostname('example.com')).toBe(false));
});

describe('assertPublicHost', () => {
  const lookup = fakeLookup({
    'public.test': ['93.184.216.34'],
    'sneaky.test': ['93.184.216.34', '10.0.0.7'],
    'rebind.test': ['127.0.0.1'],
  });

  it('allows hosts that resolve only to public addresses', async () => {
    expect(await codeOf(assertPublicHost('public.test', { lookup }))).toBeNull();
  });

  it('blocks a domain if any of its addresses is private', async () => {
    expect(await codeOf(assertPublicHost('sneaky.test', { lookup }))).toBe('BLOCKED_ADDRESS');
    expect(await codeOf(assertPublicHost('rebind.test', { lookup }))).toBe('BLOCKED_ADDRESS');
  });

  it('blocks IP literals and localhost without a DNS lookup', async () => {
    const noLookup = () => {
      throw new Error('lookup should not run');
    };
    expect(await codeOf(assertPublicHost('127.0.0.1', { lookup: noLookup }))).toBe('BLOCKED_ADDRESS');
    expect(await codeOf(assertPublicHost('[::1]', { lookup: noLookup }))).toBe('BLOCKED_ADDRESS');
    expect(await codeOf(assertPublicHost('localhost', { lookup: noLookup }))).toBe('BLOCKED_ADDRESS');
  });

  it('reports unknown domains as DNS_NOT_FOUND', async () => {
    expect(await codeOf(assertPublicHost('nope.test', { lookup }))).toBe('DNS_NOT_FOUND');
  });

  it('can be relaxed for local test fixtures', async () => {
    expect(await codeOf(assertPublicHost('127.0.0.1', { allowPrivate: true }))).toBeNull();
  });
});

describe('createSafeLookup (connect-time SSRF guard)', () => {
  const lookup = fakeLookup({ 'public.test': ['93.184.216.34'], 'rebind.test': ['192.168.0.10'] });

  it('passes public addresses through', async () => {
    const safe = createSafeLookup({ lookup });
    const address = await new Promise((resolve, reject) =>
      safe('public.test', {}, (err, addr) => (err ? reject(err) : resolve(addr))),
    );
    expect(address).toBe('93.184.216.34');
  });

  it('refuses private addresses at connection time', async () => {
    const safe = createSafeLookup({ lookup });
    const err = await new Promise((resolve) => safe('rebind.test', {}, (e) => resolve(e)));
    expect(err.code).toBe('BLOCKED_ADDRESS');
  });
});

describe('mapNetworkError (error mapping)', () => {
  it.each([
    [{ name: 'TimeoutError' }, 'TIMEOUT'],
    [{ name: 'AbortError' }, 'TIMEOUT'],
    [{ cause: { code: 'ENOTFOUND' } }, 'DNS_NOT_FOUND'],
    [{ cause: { code: 'EAI_AGAIN' } }, 'DNS_NOT_FOUND'],
    [{ cause: { code: 'ECONNREFUSED' } }, 'UNREACHABLE'],
    [{ cause: { code: 'ECONNRESET' } }, 'UNREACHABLE'],
    [{ cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }, 'TIMEOUT'],
    [{ cause: { code: 'CERT_HAS_EXPIRED' } }, 'UNREACHABLE'],
    [new Error('boom'), 'UNREACHABLE'],
  ])('%j -> %s', (err, code) => {
    expect(mapNetworkError(err).code).toBe(code);
  });
});