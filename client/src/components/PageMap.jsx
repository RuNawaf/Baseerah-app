import { displayPath } from '../format.js';
import { useI18n } from '../i18n.js';

// One page of the website is drawn as a sheet of paper with a folded corner. Its fill says how it went:
// navy steps for the worst issue on the page, red for a page that could not be scanned.
const KIND_LEGEND = {
  queued: 'tileWaiting',
  scanning: 'tileChecking',
  critical: 'tileCritical',
  serious: 'tileSerious',
  moderate: 'tileModerate',
  minor: 'tileMinor',
  clean: 'tileClean',
  failed: 'tileFailed',
  skipped: 'tileSkipped',
};
const KIND_ORDER = Object.keys(KIND_LEGEND);

export function tileKind(page) {
  if (page.status === 'succeeded') return page.worstImpact ?? (page.issueCount > 0 ? 'minor' : 'clean');
  return KIND_LEGEND[page.status] ? page.status : 'queued';
}

function tileText(page, kind) {
  if (page.status === 'succeeded') return page.issueCount > 99 ? '99+' : String(page.issueCount);
  if (kind === 'failed') return '!';
  if (kind === 'skipped') return '–';
  return '';
}

export function tileLabel(page, { t, count, impact }) {
  const path = displayPath(page.url);
  switch (page.status) {
    case 'succeeded':
      // The visible number is part of the name (WCAG 2.5.3), so voice users can say what they see.
      return page.issueCount === 0
        ? t('labelChecked0', { path })
        : t('labelChecked', {
            path,
            issues: count(page.issueCount, 'issue'),
            impact: impact(page.worstImpact ?? 'minor').toLowerCase(),
          });
    case 'failed':
      return t('labelFailed', { path });
    case 'skipped':
      return t('labelSkipped', { path });
    case 'scanning':
      return t('labelScanning', { path });
    default:
      return t('labelWaiting', { path });
  }
}

export function PageTile({ kind, text = '', small = false }) {
  return (
    <svg className={`tile tile-${kind}${small ? ' tile-small' : ''}`} viewBox="0 0 26 34" aria-hidden="true" focusable="false">
      <path className="tile-sheet" d="M1 1h17l7 7v25H1z" />
      <path className="tile-fold" d="M18 1v7h7" />
      {kind === 'scanning' && <rect className="tile-scan" x="4" y="6" width="18" height="2" />}
      {text && (
        <text x="13" y="23" textAnchor="middle">
          {text}
        </text>
      )}
    </svg>
  );
}

/**
 * The site's pages as tiles in crawl order. With `onSelect`, each tile is a button that jumps to the page's row.
 */
export function PageMap({ pages, label, onSelect }) {
  const i18n = useI18n();
  return (
    <ol className="page-map" aria-label={label ?? i18n.t('pagesFound')}>
      {pages.map((page) => {
        const kind = tileKind(page);
        const description = tileLabel(page, i18n);
        return (
          <li key={page.url} title={description}>
            {onSelect ? (
              <button type="button" className="tile-button" onClick={() => onSelect(page)} aria-label={description}>
                <PageTile kind={kind} text={tileText(page, kind)} />
              </button>
            ) : (
              <>
                <PageTile kind={kind} text={tileText(page, kind)} />
                <span className="visually-hidden">{description}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Lists only the kinds that are on screen (or the given kinds), each with its own tile as the swatch. */
export function PageMapLegend({ pages = [], kinds: only }) {
  const { t } = useI18n();
  const present = new Set(only ?? pages.map(tileKind));
  const kinds = KIND_ORDER.filter((kind) => present.has(kind));
  return (
    <ul className="legend" aria-label={t('key')}>
      {kinds.map((kind) => (
        <li key={kind}>
          <PageTile kind={kind} small text={kind === 'failed' ? '!' : kind === 'skipped' ? '–' : ''} />
          {t(KIND_LEGEND[kind])}
        </li>
      ))}
    </ul>
  );
}