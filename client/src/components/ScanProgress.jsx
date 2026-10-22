import { displayHost } from '../format.js';
import { useI18n } from '../i18n.js';
import { PageMap, PageMapLegend } from './PageMap.jsx';

const NOTIFY_HINT = { granted: 'notifyGranted', default: 'notifyDefault', denied: 'notifyDenied', unsupported: 'notifyDefault' };

export function ScanProgress({ scan, phase, notifications = 'unsupported' }) {
  const { t, count } = useI18n();
  const { progress = {}, pages = [] } = scan;
  const done = (progress.succeeded ?? 0) + (progress.failed ?? 0) + (progress.skipped ?? 0);
  const total = Math.max(progress.discovered ?? 0, 1);
  const running = phase === 'scanning';
  const host = displayHost(scan.url);

  return (
    <section className="panel progress" aria-labelledby="progress-title" aria-busy={running}>
      <header className="panel-head">
        <h2 id="progress-title">{t(running ? 'scanningTitle' : 'scannedTitle', { host })}</h2>
        {running && <p className="meta">{t(NOTIFY_HINT[notifications] ?? 'notifyDefault')}</p>}
      </header>

      {running && !progress.discovered ? (
        <p className="progress-line">{t('openingFirst')}</p>
      ) : (
        <>
          <label className="progress-line" htmlFor="crawl-progress">
            {t('progressLine', { done: count(done, 'page'), total: progress.discovered })}
            {running && progress.queued > 0 ? t('progressQueue', { n: progress.queued }) : ''}
          </label>
          <progress id="crawl-progress" max={total} value={done} />
        </>
      )}

      <dl className="strip">
        <div>
          <dt>{t('countFound')}</dt>
          <dd data-testid="count-discovered">{progress.discovered ?? 0}</dd>
        </div>
        <div>
          <dt>{t('countQueue')}</dt>
          <dd data-testid="count-queued">{progress.queued ?? 0}</dd>
        </div>
        <div>
          <dt>{t('countChecked')}</dt>
          <dd data-testid="count-succeeded">{progress.succeeded ?? 0}</dd>
        </div>
        <div>
          <dt>{t('countFailed')}</dt>
          <dd data-testid="count-failed">{progress.failed ?? 0}</dd>
        </div>
        <div>
          <dt>{t('countSkipped')}</dt>
          <dd data-testid="count-skipped">{progress.skipped ?? 0}</dd>
        </div>
      </dl>

      {pages.length > 0 && (
        <div className="map-block">
          <PageMap pages={pages} />
          <PageMapLegend pages={pages} />
        </div>
      )}
    </section>
  );
}