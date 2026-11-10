# Baseerah | بصيرة

Baseerah is a web accessibility scanner for web developers. You enter the address of a public website. Baseerah
validates it, crawls every public internal HTML page on the same origin, runs [axe-core](https://github.com/dequelabs/axe-core)
on each page, and shows the results page by page.

**SWE 444 Software Construction Laboratory, King Saud University. Team Inclusive Minds, Section 94390.**

This repository contains the working software for **Sprint 1** (US-01 to US-06) and **Sprint 2** (US-07 to US-11).

> **Scope change:** US-04 originally scanned a single webpage. It now scans the **entire website**: every page on the
> submitted URL's origin that can be reached through links, within the configurable safety limits below.

---

## Quick start

Requirements: **Node.js 22.19 or later** (the project targets Node 24 LTS, see `.nvmrc`) and npm.

```bash
npm install                              # installs the server and client workspaces
npx playwright install chromium          # the scanning browser (one time)
cp .env.example .env                     # optional, the defaults work locally
npm run dev                              # API on :4000, web app on http://localhost:5173
```

Open http://localhost:5173 and scan any public website.

**Try it on the local fixture website.** The fixture site runs on `127.0.0.1`, which SSRF protection normally blocks:

```bash
# terminal 1
npm run fixtures                         # http://127.0.0.1:4400/
# terminal 2: allow private targets for this session only
ALLOW_PRIVATE_NETWORK_TARGETS=true npm run dev
```

On Windows PowerShell, set the variable first:

```powershell
$env:ALLOW_PRIVATE_NETWORK_TARGETS = "true"; npm run dev
```

Then scan `http://127.0.0.1:4400/`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the back end (watch mode) and the front end together |
| `npm run dev:server` / `npm run dev:client` | Starts one side only |
| `npm test` | Server unit, API and crawler tests, then the front end tests |
| `npm run test:server` / `npm run test:client` | Runs one test suite |
| `npm run test:e2e` | End-to-end tests: starts the fixture site, API and web app, then drives a real browser |
| `npm run test:all` | Everything above |
| `npm run build` | Production build of the front end (`client/dist`) |
| `npm start` | Runs the API in production mode |
| `npm run fixtures` | Serves the local fixture website on port 4400 |

If Chromium is installed somewhere other than Playwright's default, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome`.

## Design

The interface uses a warm off-white ground, near-black ink, the logo's navy for data and its cobalt as the one
accent. The work sits on white sheets. The report opens
with its answer: the issue total, split by severity, and the one rule to fix first. The page map (each page of the site
as a folded sheet, darker for more severe issues) is shared by the live scan and the report. Each report has its own
link (`#/report/<scanId>`), which works for as long as the server keeps the scan (`SCAN_TTL_MINUTES`).


## Languages

The interface is available in English and Arabic. The round **ع** button in the top bar switches to Arabic (right to
left, set in Readex Pro); in Arabic the same button shows **En**. The choice is remembered in the browser. All
interface text, error messages, announcements, the tab title and notifications are translated in
`client/src/i18n.js`, with Arabic plural forms. Rule names and descriptions come from axe-core, which has no Arabic
translation, so they stay in English.

## Completion alerts

When a valid scan starts, the browser asks once for permission to show notifications. If the developer switches
to another tab, Baseerah sends a system notification when the scan finishes or fails, and clicking it returns to
the tab and opens the report. The tab title always shows live progress (`Scanning 4/10 – Baseerah`) and then the
result (`✓ Scan complete` / `✕ Scan failed`), so the result is visible even when notifications are blocked.

## Technology

| Area | Tools |
| --- | --- |
| Front end | React 19, Vite 8, Atkinson Hyperlegible fonts (self-hosted via Fontsource) |
| Back end | Node.js, Express 5, Playwright (Chromium), `@axe-core/playwright`, undici, pino |
| Tests | Vitest, Supertest, Testing Library, Playwright Test |
| Storage | In memory only. Sprint 1 has **no database**; scans expire after `SCAN_TTL_MINUTES` |

## Project structure

```
client/                     React + Vite web app
  src/
    App.jsx                 page layout and view switching (scan / report)
    useScan.js              scan lifecycle: validate → start → poll → done/failed
    api.js                  fetch wrapper with safe error handling
    validateUrl.js          client-side URL check (mirrors the server)
    completionAlert.js      browser notification + tab title when a scan ends in a background tab
    assets/                 Baseerah logo (header); favicons in client/public are cut from the same logo
    components/             Masthead, ScanForm, ScanProgress, PageMap, CompletionNotice, FailureNotice, Report
  test/                     component and validation tests (Vitest + Testing Library)
server/
  src/
    index.js                process entry: config, logger, graceful shutdown
    app.js                  Express app: security headers, JSON limit, logging, routes
    config.js               environment variables and defaults
    routes/                 /api/health, /api/scans
    controllers/            request/response handling
    services/               scanService (orchestration, status), scanStore (in-memory, TTL)
    crawler/                queue-based same-origin crawler with visited set and safety limits
    scanner/                shared Chromium + per-page loading and axe-core analysis;
                            findings.js groups results into the key checks, suggestions.js builds suggestions
    validation/             URL parsing/normalization, SSRF and reachability checks
    errors/                 error codes, AppError, JSON error handler
    middleware/             rate limiting
  test/
    unit/                   URL, normalization, SSRF, error mapping
    crawler/                crawler logic (fake site) and real-browser crawl (fixture site)
    api/                    HTTP API tests with Supertest
    fixtures/               local fixture websites (no public internet needed)
e2e/                        Playwright end-to-end tests and config
```

## Configuration

All settings are environment variables; see [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `SCAN_MAX_PAGES` | `50` | Maximum pages per website scan |
| `SCAN_MAX_DEPTH` | `5` | Maximum link depth from the start page |
| `SCAN_PAGE_TIMEOUT_MS` | `15000` | Page load timeout |
| `SCAN_CONCURRENCY` | `3` | Pages scanned at the same time |
| `SCAN_MAX_DURATION_MS` | `600000` | Hard limit for one website scan |
| `VALIDATION_TIMEOUT_MS` | `10000` | Reachability check timeout |
| `MAX_ACTIVE_SCANS` | `2` | Concurrent scans per server; extra requests get `503 SCANNER_BUSY` |
| `SCAN_TTL_MINUTES` | `60` | How long finished scans stay in memory |
| `RATE_LIMIT_PER_MINUTE` | `10` | `POST /api/scans` requests per IP per minute |
| `CORS_ORIGIN` | (empty) | Allowed front end origins when the client is hosted separately |
| `ALLOW_PRIVATE_NETWORK_TARGETS` | `false` | **Tests only.** Lets the scanner reach localhost. Ignored when `NODE_ENV=production` |
| `VITE_API_URL` | (empty) | API base URL for a separately deployed front end |

When a safety limit stops a scan, the status and the report include a `limitsReached` warning, and the UI shows it.

## API

All responses are JSON. Errors always have the shape `{ "error": { "code": "...", "message": "..." } }` and never
contain stack traces or server details.

### `GET /api/health`
`200 { "status": "ok", "service": "baseerah-api", "time": "...", "limits": { "maxPages": 50, ... } }`. The scan page shows these limits.

### `POST /api/scans`
Body: `{ "url": "https://example.com" }`. A bare domain is treated as `https://`.

The URL is validated (format, protocol, SSRF rules, reachability) **before** a scan is created.

- `202` returns the scan object (see below) with a `scanId` and a `Location: /api/scans/:scanId` header.
- `400` returns `EMPTY_URL`, `INVALID_URL`, `UNSUPPORTED_PROTOCOL`, `CREDENTIALS_NOT_ALLOWED`, `BLOCKED_ADDRESS` or `INVALID_REQUEST`.
- `422` returns `DNS_NOT_FOUND`, `UNREACHABLE`, `TIMEOUT`, `HTTP_ERROR`, `TOO_MANY_REDIRECTS` or `UNSUPPORTED_CONTENT`.
- `413` returns `PAYLOAD_TOO_LARGE`, `429` returns `RATE_LIMITED`, and `503` returns `SCANNER_BUSY`.

### `GET /api/scans/:scanId`
```jsonc
{
  "scanId": "uuid",
  "status": "queued | running | completed | completed_with_errors | failed",
  "url": "https://example.com/",
  "siteOrigin": "https://example.com",
  "createdAt": "...", "startedAt": "...", "finishedAt": "...",
  "limits": { "maxPages": 50, "maxDepth": 5, "pageTimeoutMs": 15000, "concurrency": 3, "maxDurationMs": 600000 },
  "progress": { "discovered": 10, "queued": 2, "scanning": 3, "succeeded": 4, "failed": 1, "skipped": 0, "scanned": 5 },
  "limitsReached": [{ "type": "maxPages", "message": "..." }],
  "error": null,                       // { code, message } when status is "failed"
  "pages": [{ "url", "finalUrl", "depth", "status", "httpStatus", "issueCount", "worstImpact", "durationMs", "error", "note" }],
  "report": null                       // only for completed / completed_with_errors
}
```

`report` contains `url`, `startedAt`, `finishedAt`, `totals` (`discoveredPages`, `succeededPages`, `failedPages`,
`skippedPages`, `issues`), `limitsReached`, and `pages`. Each page in `pages` also has `violations`: axe-core rule id,
impact, help text, WCAG tags, affected element count, and up to 10 elements per rule with selector and HTML.
The issue count of a page is the number of affected elements.

Since Sprint 2, each violation also has a `category` (`altText`, `contrast`, `label` or `null`), and its elements carry
extra details for these checks:

- `contrast` (US-09): `{ foreground, background, ratio, required, fontSize, fontWeight }`, as measured by axe-core.
- `suggestion` (US-08, US-11): `{ text, basis, code }` for images without alternative text and for fields or buttons
  without an accessible name. `basis` says where the text came from (`link`, `caption`, `title`, `fileName`,
  `nearbyText`, `placeholder`, `autocomplete`, `inputType`, `fieldName`, `icon`, `buttonType`), and `text` is `null`
  when nothing on the page describes the element.

Scan statuses:

- `completed`: every page scanned.
- `completed_with_errors`: some pages failed; the rest are in the report.
- `failed`: the start page could not be scanned. `error` explains why, and there is no report and no page results.

## How the crawler works

1. The start URL is validated, then loaded in headless Chromium.
2. Links (`a[href]`, `area[href]`) are collected after the page loads. Each link is resolved and normalized: the
   fragment is removed, query parameters are sorted, and default ports are dropped.
3. A link is queued only if it is `http(s)`, on the **same origin**, not a file (PDF, images, video, scripts,
   stylesheets, archives…), has no `download` attribute, and has not been seen before (visited set).
4. A breadth-first queue is processed with `SCAN_CONCURRENCY` workers until it is empty or a safety limit is hit.
5. axe-core runs on every page that loads as HTML. A page that fails is recorded with its reason and the crawl continues.
6. The scanner only navigates and reads pages. It never clicks, submits forms, downloads files or logs in.
   Dialogs are dismissed, media requests are blocked, and service workers are disabled.

## Security

- **SSRF protection.** Before scanning, the host is resolved and every address is checked. Loopback, private
  (RFC 1918), link-local (including `169.254.169.254`), CGNAT, multicast, reserved, unique-local IPv6 and
  IPv4-mapped forms are blocked, as are names like `localhost` and `*.internal`. The reachability check re-validates
  every redirect hop and pins the check to the address actually connected to, which defeats DNS rebinding. Inside
  the browser, every request goes through a guard that aborts requests to internal hosts.
- Input validation, a 10 kB JSON body limit, timeouts at every step, per-IP rate limiting, a cap on concurrent scans,
  and Helmet security headers.
- Structured JSON logs (pino) without request bodies, cookies or authorization headers. Unexpected errors are logged
  on the server and returned to clients only as a generic `INTERNAL_ERROR`.
- No secrets are needed for Sprint 1. `.env` is git-ignored.

## Key checks and suggestions (Sprint 2)

The report has a **Key checks** panel with three checks across the whole website, and each affected element shows its
details when you open a page:

| Check | axe-core rules | What the report shows |
| --- | --- | --- |
| Images without alternative text (US-07) | `image-alt`, `input-image-alt`, `area-alt`, `role-img-alt`, `svg-img-alt`, `object-alt` | A suggested alternative text and the image's code with it (US-08) |
| Text with low contrast (US-09) | `color-contrast`, `color-contrast-enhanced` | Text colour, background colour, the measured ratio and the required ratio |
| Fields and buttons without a label (US-10) | `label`, `button-name`, `input-button-name`, `select-name`, `aria-input-field-name`, `aria-toggle-field-name` | A suggested label (fields) or accessible name (icon buttons), with code (US-11) |

Decorative images (`alt=""`), images with alternative text, labelled fields and readable text are not reported.

Suggestions are rule-based, so they run on any server without an external service. After axe-core runs, the
scanner reads what the page already says about each element: the link around an image, a figure caption, the
`title` attribute, the file name, the text next to a field, its placeholder, `autocomplete` value, type or name, and
icon class names. It never changes the page. When nothing describes an element, the report says so and asks the
developer to write the text.

## Tests

The tests do not depend on public websites. The fixture site in `server/test/fixtures/` has linked internal pages,
duplicate, fragment and query-order links, an external website on a second port, a broken link, a redirect,
non-HTML files, `mailto:`/`tel:`/`javascript:` links, a form, and known accessibility issues.

| Acceptance criteria | Where they are tested |
| --- | --- |
| US-01 labeled input, valid submit, empty input | `client/test/App.test.jsx` (US-01), `e2e/tests/scan-flow.spec.js` |
| US-02 http/https only, front and back end format checks, reachability, malformed/unreachable, SSRF | `server/test/unit/url.test.js`, `server/test/unit/network.test.js`, `server/test/api/scans.api.test.js`, `client/test/validateUrl.test.js` |
| US-03 specific messages, URL kept, no scan, ARIA live announcement | `client/test/App.test.jsx` (US-02 / US-03), `e2e/tests/scan-flow.spec.js` |
| US-04 same-origin crawl, exclusions, normalization, visited set, axe on every page, failures continue, limits, progress, no form submission | `server/test/crawler/crawler.unit.test.js`, `server/test/crawler/crawler.integration.test.js`, `server/test/api/scans.api.test.js` |
| US-05 loading state, progress, completion notice, View report, report contents, no scoring | `client/test/App.test.jsx` (US-04 / US-05), `e2e/tests/scan-flow.spec.js` |
| US-05 completion alert in another tab (system notification, tab title) | `client/test/completionAlert.test.jsx` |
| US-06 failure reasons, error types, failed pages recorded, no report on full failure, no leaks | `server/test/unit/errors.test.js`, `server/test/crawler/crawler.integration.test.js`, `server/test/api/scans.api.test.js`, `client/test/App.test.jsx` (US-06) |
| US-07 to US-11 categories, contrast details, alternative-text and label suggestions | `server/test/unit/findings.test.js`, `server/test/unit/suggestions.test.js` |
| US-07 to US-11 on real pages (decorative and labelled elements not reported, suggestions linked to each element) | `server/test/crawler/crawler.integration.test.js` (fixture page `checks.html`) |
| US-07 to US-11 in the report (key checks, colours and ratio, suggestions, Arabic) | `client/test/report.test.jsx`, `e2e/tests/scan-flow.spec.js` |
| NFR-06 Baseerah's own UI has no critical/serious axe issues | `e2e/tests/scan-flow.spec.js` (scan page, error state, report; desktop and mobile) |

CI (`.github/workflows/ci.yml`) runs all suites and the production build on every pull request.

## Deployment (planned, Sprint 0 §3)

- **Front end on Vercel:** root `client`, build `npm run build`, output `dist`, and set `VITE_API_URL` to the API URL.
- **Back end on Render:** use the `Dockerfile` (based on the official Playwright image, which includes Chromium's
  system libraries). Set `NODE_ENV=production` and `CORS_ORIGIN` to the Vercel URL. Free instances sleep when idle,
  so the first scan after a pause is slower.

## Known limitations

- Scan results live in memory: they disappear on restart and are not shared between server instances.
- Pages are discovered through links only (no `sitemap.xml`, no `robots.txt` handling yet).
- Playwright does not expose the individual hops of a browser redirect. If a page redirects off the site, it is
  rejected after loading instead of before. For production, run the scanner with egress rules that block internal
  networks as a second layer.
- axe-core checks WCAG 2.x rules. Mapping them to WCAG 3.0 and the Bronze/Silver/Gold score is planned for a later sprint.
- Automated checks find only part of all accessibility barriers; manual testing is still needed.
- Suggestions are written in English and are based on what the page says about an element, so they cannot describe
  what an image actually shows. A developer should always review them.
