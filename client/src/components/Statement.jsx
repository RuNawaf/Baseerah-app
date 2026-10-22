import { useI18n } from '../i18n.js';

export function Statement() {
  const { t } = useI18n();
  return (
    <section className="statement reveal" aria-labelledby="statement-title">
      <h2 id="statement-title">
        {t('statementBefore')} <s className="struck">{t('statementStruck')}</s> {t('statementAfter')}
      </h2>
      <p>{t('statementText')}</p>
    </section>
  );
}