import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Report } from '../src/components/Report.jsx';
import { I18nContext, makeI18n } from '../src/i18n.js';
import { summarizeReport } from '../src/reportData.js';
import { completedReport, page, scanState } from './fakeApi.js';

const contrastViolation = {
  id: 'color-contrast',
  impact: 'serious',
  help: 'Elements must meet minimum color contrast ratio thresholds',
  description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA thresholds',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
  category: 'contrast',
  wcag: ['wcag2aa', 'wcag143'],
  nodeCount: 2,
  nodes: [
    {
      target: '.faint',
      html: '<p class="faint">Fresh bread</p>',
      failureSummary: '',
      contrast: { foreground: '#bbbbbb', background: '#ffffff', ratio: 1.91, required: 4.5, fontSize: '12.0pt (16px)', fontWeight: 'normal' },
    },
    {
      target: '.hero h2',
      html: '<h2>Daily</h2>',
      failureSummary: '',
      contrast: { foreground: '#777777', background: '#ffffff', ratio: 4.48, required: 4.5, fontSize: null, fontWeight: null },
    },
  ],
};

const buttonViolation = {
  id: 'button-name',
  impact: 'critical',
  help: 'Buttons must have discernible text',
  description: 'Ensures buttons have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/button-name',
  category: 'label',
  wcag: ['wcag2a', 'wcag412'],
  nodeCount: 1,
  nodes: [
    {
      target: 'button.icon-menu',
      html: '<button class="icon-menu"></button>',
      failureSummary: '',
      suggestion: { text: null, basis: 'none', kind: 'name', code: '<button aria-label="Describe what the button does" class="icon-menu"></button>' },
    },
  ],
};

const report = {
  ...completedReport,
  totals: { ...completedReport.totals, issues: 7 },
  pages: [
    ...completedReport.pages.slice(0, 2),
    page('/contact/', 'succeeded', { issueCount: 3, worstImpact: 'critical', violations: [contrastViolation, buttonViolation] }),
    completedReport.pages[2],
  ],
};
report.totals.discoveredPages = report.pages.length;
report.totals.succeededPages = 3;

function renderReport(lang = 'en') {
  const scan = scanState('completed_with_errors', { pages: report.pages, report });
  return render(
    <I18nContext.Provider value={makeI18n(lang)}>
      <Report scan={scan} headingRef={{ current: null }} onNewScan={() => {}} onScanAgain={() => {}} />
    </I18nContext.Provider>,
  );
}

async function openPage(user, path) {
  const summary = screen.getAllByText(path, { selector: '.page-path' })[0].closest('summary');
  await user.click(summary);
  return summary.closest('details');
}

describe('key checks summary (US-07, US-09, US-10)', () => {
  it('counts the affected elements and the ready suggestions for each check', () => {
    expect(summarizeReport(report).checks).toEqual({
      altText: { elements: 3, suggestions: 1, lowestRatio: null },
      contrast: { elements: 2, suggestions: 0, lowestRatio: 1.91 },
      // The icon button has a suggested code but no text, so it is not counted as a ready suggestion.
      label: { elements: 2, suggestions: 1, lowestRatio: null },
    });
  });

  it('shows the three checks in the report', () => {
    renderReport();
    const checks = screen.getByRole('region', { name: 'Key checks' });
    expect(within(checks).getByTestId('check-altText')).toHaveTextContent('3');
    expect(within(checks).getByTestId('check-contrast')).toHaveTextContent('2');
    expect(within(checks).getByTestId('check-label')).toHaveTextContent('2');
    expect(checks).toHaveTextContent('Images without alternative text');
    expect(checks).toHaveTextContent('1 suggestion ready');
    expect(checks).toHaveTextContent('Lowest ratio 1.91:1');
  });

  it('says when a check found nothing', () => {
    const clean = { ...report, pages: [page('/', 'succeeded', { violations: [] })], totals: { ...report.totals, issues: 0, discoveredPages: 1, succeededPages: 1, failedPages: 0 } };
    const scan = scanState('completed', { pages: clean.pages, report: clean });
    render(
      <I18nContext.Provider value={makeI18n('en')}>
        <Report scan={scan} headingRef={{ current: null }} onNewScan={() => {}} onScanAgain={() => {}} />
      </I18nContext.Provider>,
    );
    const checks = screen.getByRole('region', { name: 'Key checks' });
    expect(within(checks).getAllByText('None found')).toHaveLength(3);
  });
});

describe('element details in the report', () => {
  it('shows the suggested alternative text and code for an image (US-08)', async () => {
    const user = userEvent.setup();
    renderReport();
    const home = await openPage(user, '/');
    expect(within(home).getByText('Suggested alternative text')).toBeInTheDocument();
    expect(within(home).getByTestId('suggestion-text')).toHaveTextContent('Bakery logo');
    expect(home).toHaveTextContent('Based on the file name.');
    expect(home).toHaveTextContent('<img alt="Bakery logo" src="logo.png" class="logo">');
    // The page is never changed: the original element is still shown as it is.
    expect(home).toHaveTextContent('<img src="logo.png" class="logo">');
    expect(home).toHaveTextContent('Baseerah never changes your page.');
  });

  it('shows the suggested label for a field (US-11)', async () => {
    const user = userEvent.setup();
    renderReport();
    const about = await openPage(user, '/about.html');
    expect(within(about).getByText('Suggested label')).toBeInTheDocument();
    expect(within(about).getByTestId('suggestion-text')).toHaveTextContent('Email address');
    expect(about).toHaveTextContent('Based on the field type.');
    expect(about).toHaveTextContent('<label for="email">Email address</label>');
  });

  it('shows the colours and ratio of each low-contrast element (US-09)', async () => {
    const user = userEvent.setup();
    renderReport();
    const contact = await openPage(user, '/contact/');
    const ratios = within(contact).getAllByTestId('contrast-ratio');
    expect(ratios[0]).toHaveTextContent('Contrast 1.91:1, needs at least 4.5:1. Font: 12.0pt (16px), normal.');
    expect(ratios[1]).toHaveTextContent('Contrast 4.48:1, needs at least 4.5:1.');
    expect(contact).toHaveTextContent('#bbbbbb');
    expect(contact).toHaveTextContent('#ffffff');
  });

  it('asks for the text when nothing on the page describes the element', async () => {
    const user = userEvent.setup();
    renderReport();
    const contact = await openPage(user, '/contact/');
    expect(within(contact).getByText('Suggested accessible name')).toBeInTheDocument();
    expect(contact).toHaveTextContent('Nothing on the page describes this element, so write the text yourself.');
    expect(contact).toHaveTextContent('aria-label="Describe what the button does"');
  });

  it('is translated into Arabic', async () => {
    const user = userEvent.setup();
    renderReport('ar');
    expect(screen.getByRole('region', { name: 'أهم الفحوصات' })).toHaveTextContent('صور بلا نص بديل');
    const contact = await openPage(user, '/contact/');
    expect(within(contact).getAllByTestId('contrast-ratio')[0]).toHaveTextContent('التباين 1.91:1، والمطلوب 4.5:1 على الأقل.');
    expect(contact).toHaveTextContent('الاسم المقترح');
  });
});