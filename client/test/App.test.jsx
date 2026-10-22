import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App.jsx';
import { completedReport, jsonResponse, mockApi, page, scanState, SITE } from './fakeApi.js';

function setup() {
  const user = userEvent.setup();
  render(<App pollIntervalMs={5} />);
  const input = screen.getByLabelText('Website URL');
  const button = screen.getByRole('button', { name: 'Scan website' });
  return { user, input, button };
}

describe('US-01: enter a website URL', () => {
  it('shows a labeled URL field and a Scan website button', () => {
    const { input, button } = setup();
    expect(input).toHaveAttribute('id', 'url');
    expect(button).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Baseerah');
  });

  it('shows a required-field message and does not start a scan when the input is empty', async () => {
    const fetchMock = mockApi({ post: [202, {}] });
    const { user, button, input } = setup();
    await user.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a website URL to scan.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(fetchMock.scanCalls()).toHaveLength(0);
  });

  it('can be submitted with the keyboard', async () => {
    const fetchMock = mockApi({ post: [202, scanState('queued')], polls: [scanState('running')] });
    const { user, input } = setup();
    await user.type(input, 'bakery.example{Enter}');
    expect(fetchMock).toHaveBeenCalledWith('/api/scans', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'bakery.example' }) }));
  });
});

describe('US-02 / US-03: invalid URL errors', () => {
  it.each([
    ['http://exa mple.com', 'not a valid web address'],
    ['ftp://bakery.example/file', 'Only http:// and https://'],
    ['https://user:pw@bakery.example', 'Remove the username or password'],
  ])('rejects %s in the browser without calling the API', async (value, message) => {
    const fetchMock = mockApi({ post: [202, {}] });
    const { user, input, button } = setup();
    await user.type(input, value);
    await user.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(input).toHaveValue(value);
    expect(fetchMock.scanCalls()).toHaveLength(0);
  });

  it.each([
    ['BLOCKED_ADDRESS', 400, 'This address points to a private or internal network (such as localhost).'],
    ['UNREACHABLE', 422, 'The website could not be reached. Check that it is online and publicly accessible.'],
    ['TIMEOUT', 422, 'The website took too long to respond.'],
    ['DNS_NOT_FOUND', 422, 'No website was found at this domain.'],
  ])('shows the server message for %s and keeps the URL for correction', async (code, status, message) => {
    mockApi({ post: [status, { error: { code, message } }] });
    const { user, input, button } = setup();
    await user.type(input, 'https://internal.example');
    await user.click(button);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(input).toHaveValue('https://internal.example');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('url-error'));
    expect(button).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /Scanning/ })).not.toBeInTheDocument();
  });

  it('clears the error when the URL is edited', async () => {
    mockApi({ post: [202, {}] });
    const { user, input, button } = setup();
    await user.click(button);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(input, 'b');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains when the front end is deployed without its API', async () => {
    mockApi({ post: [404, { error: { code: 'NOT_FOUND', message: 'The page could not be found' } }] });
    const { user, input, button } = setup();
    await user.type(input, 'https://www.ksu.edu.sa');
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('scanning server is not connected to this site yet');
  });

  it('explains when the Baseerah server cannot be reached', async () => {
    mockApi({ post: () => Promise.reject(new TypeError('Failed to fetch')) });
    const { user, input, button } = setup();
    await user.type(input, 'https://bakery.example');
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Baseerah could not reach its server');
  });
});

describe('US-04 / US-05: progress, completion and report', () => {
  const running = scanState('running', {
    pages: [page('/', 'succeeded', { issueCount: 3 }), page('/about.html', 'scanning'), page('/contact/', 'queued')],
  });

  it('shows a loading state and disables repeat submissions', async () => {
    let resolvePost;
    mockApi({ post: () => new Promise((resolve) => (resolvePost = resolve)), polls: [running] });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Checking address…');
    expect(input).toHaveAttribute('readonly');
    resolvePost(await jsonResponse(202, scanState('queued')));
    expect(await screen.findByRole('button', { name: 'Scanning…' })).toBeDisabled();
  });

  it('shows crawl progress while pages are being scanned', async () => {
    mockApi({ post: [202, scanState('queued')], polls: [running] });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);

    expect(await screen.findByRole('heading', { name: 'Scanning bakery.example' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('count-discovered')).toHaveTextContent('3'));
    expect(screen.getByTestId('count-queued')).toHaveTextContent('1');
    expect(screen.getByTestId('count-succeeded')).toHaveTextContent('1');
    const map = screen.getByRole('list', { name: 'Pages found on the website' });
    expect(within(map).getAllByRole('listitem')).toHaveLength(3);
    expect(within(map).getByText('/about.html: checking now')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '3');
  });

  it('announces completion and opens the report', async () => {
    const done = scanState('completed_with_errors', { pages: completedReport.pages, report: completedReport });
    mockApi({ post: [202, scanState('queued')], polls: [running, done] });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);

    const notice = await screen.findByRole('region', { name: 'Scan complete' });
    expect(notice).toHaveTextContent('2 pages checked and 4 accessibility issues found. 1 page could not be scanned.');
    expect(notice).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Scan complete. 2 pages checked, 4 accessibility issues found.');

    await user.click(within(notice).getByRole('button', { name: 'View report' }));

    const heading = screen.getByRole('heading', { level: 1, name: 'Accessibility report for bakery.example' });
    expect(heading).toHaveFocus();
    expect(window.location.hash).toBe('#/report/11111111-1111-4111-8111-111111111111');

    // The answer first: the issue total, split by severity, and what to fix first.
    expect(screen.getByTestId('total-issues')).toHaveTextContent('4');
    expect(screen.getByTestId('sev-critical')).toHaveTextContent('3');
    expect(screen.getByTestId('sev-serious')).toHaveTextContent('1');
    expect(screen.getByTestId('sev-moderate')).toHaveTextContent('0');
    expect(screen.getByText(/Fix first:/).closest('p')).toHaveTextContent(
      'Fix first: Images must have alternative text. Critical, 3 elements on 1 page.',
    );

    // The page counts add up: found = scanned + could not be scanned + skipped.
    expect(screen.getByTestId('total-discovered')).toHaveTextContent('3');
    expect(screen.getByTestId('total-succeeded')).toHaveTextContent('2');
    expect(screen.getByTestId('total-failed')).toHaveTextContent('1');
    expect(screen.getByTestId('total-skipped')).toHaveTextContent('0');
    expect(screen.getByText(/^Started .*, finished .*/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${SITE}/` })).toBeInTheDocument();

    const pages = screen.getByRole('region', { name: 'Page by page' });
    expect(within(pages).getByText('/')).toBeInTheDocument();
    await user.click(within(pages).getByText('/'));
    expect(screen.getByRole('heading', { name: 'Images must have alternative text' })).toBeVisible();
    expect(pages).toHaveTextContent('/missing.html');
    expect(pages).toHaveTextContent('Could not be scanned. The page responded with HTTP 404.');

    // Selecting a tile in the page map opens that page's row.
    const map = screen.getByRole('list', { name: 'Pages on the website' });
    await user.click(within(map).getByRole('button', { name: /\/about\.html: checked, 1 issue/ }));
    expect(screen.getByRole('heading', { name: 'Form elements must have labels' })).toBeVisible();

    expect(screen.queryByText(/bronze|silver|gold/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Scan another website' }));
    expect(screen.getByLabelText('Website URL')).toHaveValue('');
    expect(window.location.hash).toBe('');
  });

  it('scans the same website again from the report', async () => {
    const done = scanState('completed_with_errors', { pages: completedReport.pages, report: completedReport });
    const fetchMock = mockApi({ post: [202, scanState('queued')], polls: [done] });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);
    await user.click(await screen.findByRole('button', { name: 'View report' }));
    await user.click(screen.getByRole('button', { name: 'Scan again' }));
    expect(fetchMock.scanCalls().filter(([, o]) => o?.method === 'POST')).toHaveLength(2);
    expect(screen.getByLabelText('Website URL')).toHaveValue(`${SITE}/`);
  });

  it('reopens a report from its link after a reload', async () => {
    const done = scanState('completed', { pages: completedReport.pages, report: completedReport });
    mockApi({ post: [202, {}], polls: [done] });
    window.location.hash = '#/report/11111111-1111-4111-8111-111111111111';
    render(<App pollIntervalMs={5} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Accessibility report for bakery.example' })).toBeInTheDocument();
    window.location.hash = '';
  });

  it('shows what a scan will do, with the server limits', async () => {
    mockApi({ post: [202, {}] });
    setup();
    const about = screen.getByRole('region', { name: 'What a scan does' });
    await waitFor(() => expect(within(about).getByText('15').closest('dt')).toHaveTextContent('15 s per page'));
    expect(about).toHaveTextContent('with 3 pages checked at a time');
    expect(within(about).getByText('5').closest('dt')).toHaveTextContent('5 links deep');
  });

  it('shows a warning when a safety limit stopped the scan', async () => {
    const limited = { ...completedReport, limitsReached: [{ type: 'maxPages', message: 'The scan stopped at the 50-page limit, so some pages on this website were not scanned.' }] };
    const done = { ...scanState('completed', { pages: completedReport.pages, report: limited }), limitsReached: limited.limitsReached };
    mockApi({ post: [202, scanState('queued')], polls: [done] });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);
    expect(await screen.findByText(/Stopped early: The scan stopped at the 50-page limit/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View report' }));
    expect(screen.getByText(/Partial scan\./)).toBeInTheDocument();
  });
});

describe('US-06: complete scan failure', () => {
  it('shows the reason, no report and no results', async () => {
    const failed = scanState('failed', { error: { code: 'TIMEOUT', message: 'The page did not finish loading within 15 seconds.' } });
    mockApi({ post: [202, scanState('queued')], polls: [failed] });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);

    const notice = await screen.findByRole('region', { name: 'The scan could not be completed' });
    expect(notice).toHaveTextContent('The page did not finish loading within 15 seconds.');
    expect(notice).toHaveTextContent('No report was created');
    expect(screen.queryByRole('button', { name: 'View report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pages found on the website' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Scan failed.');
    expect(button).toBeEnabled();
    expect(notice).not.toHaveTextContent(/at .*\.js|stack/i);
  });

  it('fails cleanly when the scan expires on the server', async () => {
    mockApi({
      post: [202, scanState('queued')],
      polls: [() => jsonResponse(404, { error: { code: 'SCAN_NOT_FOUND', message: 'This scan does not exist or has expired. Start a new scan.' } })],
    });
    const { user, input, button } = setup();
    await user.type(input, SITE);
    await user.click(button);
    expect(await screen.findByRole('region', { name: 'The scan could not be completed' })).toHaveTextContent('has expired');
  });
});

describe('language switch', () => {
  it('switches the whole interface to Arabic and back', async () => {
    mockApi({ post: [400, { error: { code: 'BLOCKED_ADDRESS', message: 'This address points to a private network.' } }] });
    const { user, input } = setup();

    await user.click(screen.getByRole('button', { name: /العربية/ }));
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('بصيرة');
    expect(screen.getByLabelText('رابط الموقع')).toBe(input);

    // Errors from the API are shown in Arabic, from their code.
    await user.type(input, 'http://10.0.0.1');
    await user.click(screen.getByRole('button', { name: 'افحص الموقع' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('هذا الرابط يشير إلى شبكة خاصة أو داخلية');

    await user.click(screen.getByRole('button', { name: /English/ }));
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Baseerah');
    window.localStorage.clear();
  });

  it('uses Arabic plural forms', async () => {
    const { countWord } = await import('../src/i18n.js');
    expect(countWord('ar', 1, 'page')).toBe('صفحة واحدة');
    expect(countWord('ar', 2, 'page')).toBe('صفحتان');
    expect(countWord('ar', 5, 'page')).toBe('5 صفحات');
    expect(countWord('ar', 12, 'page')).toBe('12 صفحة');
    expect(countWord('en', 1, 'page')).toBe('1 page');
  });
});

describe('product preview', () => {
  it('brings the card behind to the front when selected', async () => {
    mockApi({ post: [202, {}] });
    const { user } = setup();
    const stack = document.querySelector('.preview-stack');
    expect(stack.querySelector('.card-report')).toHaveClass('is-front');

    // Clicking the cards swaps them.
    await user.click(stack);
    expect(stack.querySelector('.card-scan')).toHaveClass('is-front');

    // The labelled button does the same for keyboard and screen reader users.
    const button = screen.getByRole('button', { name: 'Show the report' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(stack.querySelector('.card-report')).toHaveClass('is-front');
    expect(screen.getByRole('button', { name: 'Show the scan in progress' })).toBeInTheDocument();
  });
});