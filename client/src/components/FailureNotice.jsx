import { forwardRef } from 'react';
import { useI18n } from '../i18n.js';

export const FailureNotice = forwardRef(function FailureNotice({ error, onRetry }, ref) {
  const { t, error: errorText } = useI18n();
  return (
    <section className="notice notice-failed" aria-labelledby="failed-title" ref={ref} tabIndex={-1}>
      <div className="notice-text">
        <h2 id="failed-title">{t('failedTitle')}</h2>
        <p>{error ? errorText(error) : t('failedUnknown')}</p>
        <p className="notice-detail">{t('failedNoReport')}</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        {t('tryAgain')}
      </button>
    </section>
  );
});