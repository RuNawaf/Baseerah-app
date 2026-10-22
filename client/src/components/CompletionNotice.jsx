import { forwardRef } from 'react';
import { useI18n } from '../i18n.js';

export const CompletionNotice = forwardRef(function CompletionNotice({ scan, onViewReport }, ref) {
  const { t, count, limit } = useI18n();
  const { totals, limitsReached } = scan.report;

  return (
    <section className="notice notice-done" aria-labelledby="done-title" ref={ref} tabIndex={-1}>
      <div className="notice-text">
        <h2 id="done-title">{t('doneTitle')}</h2>
        <p>
          {t('doneText', { pages: count(totals.succeededPages, 'page'), issues: count(totals.issues, 'accessibilityIssue') })}
          {totals.failedPages > 0 && ` ${t('doneFailed', { pages: count(totals.failedPages, 'page') })}`}
        </p>
        {limitsReached.length > 0 && (
          <p className="notice-warning">
            {t('stoppedEarly')} {limit(limitsReached[0], scan.limits)}
          </p>
        )}
      </div>
      <button type="button" className="btn btn-primary" onClick={onViewReport}>
        {t('viewReport')}
      </button>
    </section>
  );
});