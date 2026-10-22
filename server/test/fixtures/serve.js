// Local fixture websites for crawler, API and end-to-end tests. No public internet needed.
//
//   site:     the website being scanned (internal pages, duplicates, broken links, files…)
//   external: a second origin that the site links to; the crawler must never visit it
//
// Run directly (`npm run fixtures`) to browse or scan it by hand.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port)));
}

export async function startFixtureServers({ sitePort = 0, externalPort = 0 } = {}) {
  const hits = { site: [], external: [] };

  const external = http.createServer((req, res) => {
    hits.external.push(req.url);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html lang="en"><head><title>Partner</title></head><body><main><h1>Partner site</h1></main></body></html>');
  });
  const externalOrigin = `http://127.0.0.1:${await listen(external, externalPort)}`;

  const site = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://fixture');
    hits.site.push(req.url);

    if (pathname === '/redirect-me') {
      res.writeHead(302, { location: '/about.html' });
      return res.end();
    }
    if (pathname === '/leave') {
      res.writeHead(302, { location: `${externalOrigin}/` });
      return res.end();
    }
    if (pathname === '/slow.html') return; // never answers: used for timeout tests
    if (pathname === '/server-error.html') {
      res.writeHead(500, { 'content-type': 'text/html' });
      return res.end('<h1>Server error</h1>');
    }

    let filePath = path.normalize(path.join(SITE_ROOT, decodeURIComponent(pathname)));
    if (!filePath.startsWith(SITE_ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><html lang="en"><head><title>Not found</title></head><body><h1>Not found</h1></body></html>');
    }

    const type = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    if (type.startsWith('text/html')) {
      return res.end(readFileSync(filePath, 'utf8').replaceAll('{{EXTERNAL_ORIGIN}}', externalOrigin));
    }
    return createReadStream(filePath).pipe(res);
  });
  const siteOrigin = `http://127.0.0.1:${await listen(site, sitePort)}`;

  return {
    siteOrigin,
    externalOrigin,
    hits,
    async close() {
      site.closeAllConnections();
      external.closeAllConnections();
      await Promise.all([new Promise((r) => site.close(r)), new Promise((r) => external.close(r))]);
    },
  };
}

// Compare resolved, case-insensitive paths: on Windows the drive letter case can differ.
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();

if (isMain) {
  const servers = await startFixtureServers({
    sitePort: Number(process.env.FIXTURE_PORT ?? 4400),
    externalPort: Number(process.env.FIXTURE_EXTERNAL_PORT ?? 4401),
  });
  console.log(`Fixture site:     ${servers.siteOrigin}/`);
  console.log(`External site:    ${servers.externalOrigin}/`);
}