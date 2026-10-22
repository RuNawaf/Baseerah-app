import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const FIXTURE_URL = 'http://127.0.0.1:4400/';

async function expectNoSeriousAxeIssues(page) {
  // Check the page as it rests: entrance motion finished and every section shown (axe measures live opacity).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-visible')));
  await page.waitForTimeout(100);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('scans the whole fixture website and opens the report @mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Baseerah/);

  await page.getByLabel('Website URL').fill(FIXTURE_URL);
  await page.getByRole('button', { name: 'Scan website' }).click();

  // Loading state and live progress.
  await expect(page.getByRole('button', { name: /Checking address|Scanning/ })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Scanning 127.0.0.1:4400' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Pages found on the website' }).getByRole('listitem').first()).toBeVisible();

  const notice = page.getByRole('region', { name: 'Scan complete' });
  await expect(notice).toBeVisible({ timeout: 90_000 });
  await expect(notice).toContainText('8 pages checked');
  await expect(notice).toContainText('1 page could not be scanned');
  await page.screenshot({ path: 'test-results/screens/progress-complete.png', fullPage: true });

  await notice.getByRole('button', { name: 'View report' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Accessibility report for 127.0.0.1:4400' })).toBeFocused();
  await expect(page).toHaveURL(/#\/report\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('total-discovered')).toHaveText('10');
  await expect(page.getByTestId('total-succeeded')).toHaveText('8');
  await expect(page.getByTestId('total-failed')).toHaveText('1');
  await expect(page.getByTestId('total-skipped')).toHaveText('1');
  await expect(page.getByText(/^Fix first:/)).toBeVisible();

  const rows = page.getByRole('region', { name: 'Page by page' });
  await expect(rows).toContainText('/missing.html');
  await expect(rows).toContainText('Could not be scanned. The page responded with HTTP 404.');

  // External links were never crawled.
  await expect(page.getByText('127.0.0.1:4401')).toHaveCount(0);

  await rows.locator('summary').first().click();
  await expect(rows.getByRole('heading', { level: 4 }).first()).toBeVisible();
  await page.screenshot({ path: `test-results/screens/report-${test.info().project.name}.png`, fullPage: true });

  // The report link survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Accessibility report for 127.0.0.1:4400' })).toBeVisible();

  await expectNoSeriousAxeIssues(page);
});

test('validation errors are shown next to the field and the URL is kept', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Website URL');

  await page.getByRole('button', { name: 'Scan website' }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter a website URL to scan.');
  await expect(input).toBeFocused();

  await input.fill('ftp://example.com/file');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Only http:// and https:// addresses can be scanned.');
  await expect(input).toHaveValue('ftp://example.com/file');

  // Server-side check: the address answers with 404.
  await input.fill('http://127.0.0.1:4400/missing.html');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('HTTP 404');
  await expect(input).toHaveValue('http://127.0.0.1:4400/missing.html');
  await page.screenshot({ path: 'test-results/screens/error.png', fullPage: true });

  await expectNoSeriousAxeIssues(page);
});

test('the scan page has no serious accessibility issues and works with the keyboard', async ({ page }) => {
  await page.goto('/');
  await expectNoSeriousAxeIssues(page);

  await page.keyboard.press('Tab'); // skip link
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  // The top bar's "Scan a website" action jumps straight to the field.
  await page.getByRole('button', { name: 'Scan a website' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Website URL')).toBeFocused();
  await page.keyboard.type(FIXTURE_URL);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Scan website' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Scan complete' })).toBeFocused({ timeout: 90_000 });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'View report' })).toBeFocused();
});

test('the Arabic interface reads right to left and has no serious accessibility issues', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ع العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('بصيرة');
  await page.screenshot({ path: 'test-results/screens/arabic.png', fullPage: true });
  await expectNoSeriousAxeIssues(page);

  // The choice is remembered on reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('بصيرة');
});