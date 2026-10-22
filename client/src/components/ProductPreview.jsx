import { useState } from 'react';
import { useI18n } from '../i18n.js';
import { PageTile } from './PageMap.jsx';

// An eye chart, the subject's own object, drawn as a faint background picture behind the product.
const CHART = ['E', 'F P', 'T O Z', 'L P E D'];
const CHART_SVG = (() => {
  let y = 0;
  const lines = CHART.map((letters, index) => {
    const size = Math.round(200 * 0.68 ** index);
    y += size * 1.12;
    return `<text x="300" y="${Math.round(y)}" font-size="${size}" letter-spacing="${Math.round(size * 0.12)}">${letters}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${Math.round(y + 20)}"><g fill="#2f5bff" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">${lines}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

// A real report from the bundled demo website (server/test/fixtures/site), drawn with the app's own parts.
const DEMO_TILES = ['critical', 'critical', 'critical', 'critical', 'clean', 'skipped', 'failed', 'clean', 'clean', 'clean'];
const DEMO_TEXT = ['2', '1', '1', '1', '0', '–', '!', '0', '0', '0'];

function ScanCard({ t }) {
  return (
    <>
      <div className="pc-bar">
        <span className="pc-host">bakery.example</span>
        <span className="pc-dim">{t('previewScanning')}</span>
      </div>
      <div className="pc-progress">
        <span style={{ width: '60%' }} />
      </div>
      <div className="pc-tiles">
        {DEMO_TILES.map((kind, index) => (
          <PageTile
            key={index}
            kind={index < 6 ? kind : index === 6 ? 'scanning' : 'queued'}
            text={index < 6 ? DEMO_TEXT[index] : ''}
          />
        ))}
      </div>
      <ul className="pc-rows">
        <li>
          <span dir="ltr">/missing.html</span>
          <span className="pc-state">{t('fragChecking')}</span>
        </li>
        <li>
          <span dir="ltr">/deep/2.html</span>
          <span className="pc-state">{t('fragWaiting')}</span>
        </li>
        <li>
          <span dir="ltr">/deep/3.html</span>
          <span className="pc-state">{t('fragWaiting')}</span>
        </li>
      </ul>
    </>
  );
}

function ReportCard({ t }) {
  return (
    <>
      <div className="pc-bar">
        <span className="pc-host">bakery.example</span>
        <span className="pc-pill">{t('previewReport')}</span>
      </div>
      <p className="pc-fix">
        <strong>{t('fixFirst')}</strong> <bdi>Form elements must have labels.</bdi>
      </p>
      <div className="pc-grid">
        <div>
          <p className="pc-label">{t('issuesTitle')}</p>
          <p className="pc-figure">5</p>
          <div className="pc-sev">
            <span className="sev-critical" style={{ flexGrow: 4 }} />
            <span className="sev-serious" style={{ flexGrow: 1 }} />
          </div>
          <p className="pc-dim">{t('previewSeverity')}</p>
        </div>
        <div>
          <p className="pc-label">{t('pagesTitle')}</p>
          <div className="pc-tiles">
            {DEMO_TILES.map((kind, index) => (
              <PageTile key={index} kind={kind} text={DEMO_TEXT[index]} />
            ))}
          </div>
          <p className="pc-dim">{t('previewTally')}</p>
        </div>
      </div>
      <ul className="pc-rows">
        <li>
          <span dir="ltr">/</span>
          <span>2</span>
        </li>
        <li>
          <span dir="ltr">/about.html</span>
          <span>1</span>
        </li>
        <li>
          <span dir="ltr">/contact/</span>
          <span>1</span>
        </li>
      </ul>
    </>
  );
}

/**
 * The product on two stacked cards: the live scan and the report it produces.
 * Selecting the stack shuffles the card behind to the front.
 */
export function ProductPreview() {
  const { t } = useI18n();
  const [front, setFront] = useState('report');
  const [swapped, setSwapped] = useState(false);
  const next = front === 'report' ? 'scan' : 'report';
  const label = t(next === 'scan' ? 'previewShowScan' : 'previewShowReport');
  const toggle = () => {
    setSwapped(true);
    setFront(next);
  };

  return (
    <div className="preview">
      <div className="eye-chart" style={{ backgroundImage: CHART_SVG }} />
      {/* Pointer users click the cards; keyboard and screen reader users get the labelled button below. */}
      <div className={`preview-stack${swapped ? ' swapped' : ''}`} onClick={toggle} aria-hidden="true">
        <div className={`preview-card card-scan ${front === 'scan' ? 'is-front' : 'is-back'}`} data-ui>
          <ScanCard t={t} />
        </div>
        <div className={`preview-card card-report ${front === 'report' ? 'is-front' : 'is-back'}`} data-ui>
          <ReportCard t={t} />
        </div>
      </div>
      <button type="button" className="preview-switch" onClick={toggle}>
        <svg className="arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" />
        </svg>
        {label}
      </button>
    </div>
  );
}