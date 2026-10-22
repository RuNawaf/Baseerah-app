import { useI18n } from '../i18n.js';
import { PageTile } from './PageMap.jsx';

/** How a scan works: its three stages with a piece of the real interface each, then the server's real limits. */
export function ScanAbout({ limits }) {
  const { t, impact } = useI18n();
  const concurrency = limits ? limits.concurrency : 3;
  const facts = [
    { figure: limits ? limits.maxDepth : 5, unit: t('factDepth'), text: t('factDepthText') },
    { figure: limits ? Math.round(limits.pageTimeoutMs / 1000) : 15, unit: t('factTime'), text: t('factTimeText', { n: concurrency }) },
    { figure: 0, unit: t('factForms'), text: t('factFormsText') },
  ];
  const crawlRows = [
    ['/', 'critical', '2', t('fragChecked')],
    ['/about.html', 'critical', '1', t('fragChecked')],
    ['/about.html?a=1&b=2', 'critical', '1', t('fragChecked')],
    ['/missing.html', 'failed', '!', 'HTTP 404'],
    ['/contact/', 'scanning', '', t('fragChecking')],
    ['/deep/1.html', 'queued', '', t('fragWaiting')],
  ];
  const [fixBefore, fixAfter] = t('fragFixText').split('{alt}');
  const [fixMiddle, fixEnd] = fixAfter.split('{empty}');

  return (
    <section className="facts reveal" id="how" aria-labelledby="about-title">
      <h2 id="about-title">{t('aboutTitle')}</h2>
      <p className="facts-lede">{t('aboutLede')}</p>

      <ol className="stages">
        <li className="stage">
          <h3>{t('stage1Title')}</h3>
          <p>{t('stage1Text')}</p>
          <div className="fragment" data-ui aria-hidden="true">
            {crawlRows.map(([path, kind, text, state]) => (
              <div className="frag-row" key={path}>
                <PageTile kind={kind} small text={text} />
                <span dir="ltr" className="frag-path">
                  {path}
                </span>
                <span className="frag-dim">{state}</span>
              </div>
            ))}
          </div>
        </li>
        <li className="stage">
          <h3>{t('stage2Title')}</h3>
          <p>{t('stage2Text')}</p>
          <div className="fragment" data-ui aria-hidden="true">
            <div className="frag-head">
              <strong dir="ltr">Images must have alternative text</strong>
              <span className="frag-impact">
                <span className="impact-meter">
                  <span className="on sev-critical" />
                  <span className="on sev-critical" />
                  <span className="on sev-critical" />
                  <span className="on sev-critical" />
                </span>
                {impact('critical')}
              </span>
            </div>
            <code className="frag-code" dir="ltr">
              &lt;img src=&quot;img/logo.png&quot; width=&quot;64&quot;&gt;
            </code>
            <p className="frag-dim">{t('fragBlind')}</p>
            <p className="frag-line">
              <strong>{t('fragFix')}</strong> {fixBefore}
              <code>alt</code>
              {fixMiddle}
              <code>alt=&quot;&quot;</code>
              {fixEnd}
            </p>
            <p className="frag-dim">{t('fragWcag')}</p>
          </div>
        </li>
        <li className="stage">
          <h3>{t('stage3Title')}</h3>
          <p>{t('stage3Text')}</p>
          <div className="fragment" data-ui aria-hidden="true">
            <p className="frag-fix">
              <strong>{t('fixFirst')}</strong> <bdi>Form elements must have labels.</bdi>
            </p>
            <div className="frag-sev">
              <span className="sev-critical" style={{ flexGrow: 4 }} />
              <span className="sev-serious" style={{ flexGrow: 1 }} />
            </div>
            {[
              ['critical', 4],
              ['serious', 1],
              ['moderate', 0],
              ['minor', 0],
            ].map(([level, n]) => (
              <div className={`frag-row frag-split${n === 0 ? ' is-zero' : ''}`} key={level}>
                <span>{impact(level)}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
        </li>
      </ol>

      <dl className="facts-row">
        {facts.map((fact) => (
          <div key={fact.unit}>
            <dt>
              <span className="fact-figure">{fact.figure}</span> {fact.unit}
            </dt>
            <dd>{fact.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}