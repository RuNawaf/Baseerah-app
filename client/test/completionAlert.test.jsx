import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { completedReport, mockApi, page, scanState, SITE } from './fakeApi.js';

let hidden = false;
let notifications;

class FakeNotification {
  static permission = 'granted';
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  constructor(title, options) {
    this.title = title;
    this.options = options;
    this.close = vi.fn();
    notifications.push(this);
  }
}

function setHidden(value) {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  notifications = [];
  hidden = false;
  FakeNotification.permission = 'granted';
  FakeNotification.requestPermission.mockClear();
  vi.stubGlobal('Notification', FakeNotification);
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  window.focus = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const running = scanState('running', { pages: [page('/', 'succeeded', { issueCount: 3 }), page('/about.html', 'scanning'), page('/contact/', 'queued')] });
const done = scanState('completed_with_errors', { pages: completedReport.pages, report: completedReport });

async function startScan(polls) {
  mockApi({ post: [202, scanState('queued')], polls });
  const user = userEvent.setup();
  render(<App pollIntervalMs={20} />);
  await user.type(screen.getByLabelText('Website URL'), SITE);
  await user.click(screen.getByRole('button', { name: 'Scan website' }));
  return user;
}

describe('completion alert when the developer is in another tab', () => {
  it('asks for notification permission when a valid scan is submitted, not for invalid input', async () => {
    FakeNotification.permission = 'default';
    mockApi({ post: [202, scanState('queued')], polls: [running] });
    const user = userEvent.setup();
    render(<App pollIntervalMs={20} />);
    await user.click(screen.getByRole('button', { name: 'Scan website' }));
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Website URL'), SITE);
    await user.click(screen.getByRole('button', { name: 'Scan website' }));
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('shows progress in the tab title while scanning', async () => {
    await startScan([running]);
    await vi.waitFor(() => expect(document.title).toBe('Scanning 1/3 – Baseerah'));
    expect(screen.getByText(/Baseerah will send a notification when the scan finishes/)).toBeInTheDocument();
  });

  it('sends a notification and marks the tab title when the scan finishes in a hidden tab', async () => {
    await startScan([running, running, done]);
    setHidden(true);

    await vi.waitFor(() => expect(notifications).toHaveLength(1));
    const [notification] = notifications;
    expect(notification.title).toBe('Scan complete');
    expect(notification.options.body).toBe('bakery.example: 2 pages checked, 4 accessibility issues found.');
    expect(notification.options.icon).toBe('/favicon-64.png');
    expect(document.title).toBe('Scan complete – Baseerah');

    // Clicking the notification brings the tab back and opens the report.
    act(() => notification.onclick());
    expect(window.focus).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Accessibility report for bakery.example' })).toBeInTheDocument();
    expect(notification.close).toHaveBeenCalled();

    act(() => setHidden(false));
    expect(document.title).toBe('Baseerah – website accessibility scanner');
  });

  it('notifies about a failed scan in a hidden tab', async () => {
    const failed = scanState('failed', { error: { code: 'TIMEOUT', message: 'The page did not finish loading within 15 seconds.' } });
    await startScan([running, failed]);
    setHidden(true);
    await vi.waitFor(() => expect(notifications).toHaveLength(1));
    expect(notifications[0].title).toBe('Scan failed');
    expect(notifications[0].options.body).toBe('The page did not finish loading within 15 seconds.');
    expect(document.title).toBe('Scan failed – Baseerah');
  });

  it('does not send a system notification while the tab is visible', async () => {
    await startScan([done]);
    await screen.findByRole('region', { name: 'Scan complete' });
    expect(notifications).toHaveLength(0);
    expect(document.title).toBe('Baseerah – website accessibility scanner');
  });

  it('still updates the tab title when notifications are blocked', async () => {
    FakeNotification.permission = 'denied';
    await startScan([running, done]);
    setHidden(true);
    await vi.waitFor(() => expect(document.title).toBe('Scan complete – Baseerah'));
    expect(notifications).toHaveLength(0);
  });
});