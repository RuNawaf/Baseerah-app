import { useMemo, useRef } from 'react';
import { displayHost, displayPath, formatDuration, formatTime } from '../format.js';
import { useI18n } from '../i18n.js';
import { CHECKS, IMPACTS, summarizeReport } from '../reportData.js';
import { PageMap, PageMapLegend, PageTile, tileKind } from './PageMap.jsx';

const MAX_RULES = 5;

function Impact({ impact }) {
  const { impact: impactLabel } = useI18n();
  const level = 4 - IMPACTS.indexOf(impact);
  return (
    <span className="impact">
      <span className="impact-meter" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={n <= level ? `on sev-${impact}` : ''} />
        ))}
      </span>
      {impactLabel(impact)}
    </span>
  );
}

/** A 100% bar of the issues by severity, with the legend as a table that carries the figures. */
function SeverityBreakdown({ byImpact, total }) {
  const { t, impact: impactLabel } = useI18n();
  return (
    <>
      <div className="sev-bar" aria-hidden="true">
        {total > 0 ? (
          IMPACTS.filter((impact) => byImpact[impact] > 0).map((impact) => (
            <span key={impact} className={`sev-${impact}`} style={{ flexGrow: byImpact[impact] }} />
          ))
        ) : (
          <span className="sev-none" />
        )}
      </div>
      <table className="sev-table">
        <caption className="visually-hidden">{t('severityCaption')}</caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">{t('severity')}</th>
            <th scope="col">{t('colIssues')}</th>
            <th scope="col">{t('share')}</th>
          </tr>
        </thead>
        <tbody>
          {IMPACTS.map((impact) => (
            <tr key={impact} className={byImpact[impact] === 0 ? 'is-zero' : ''}>
              <th scope="row">
                <span className={`swatch sev-${impact}`} aria-hidden="true" />
                {impactLabel(impact)}
              </th>
              <td className="num" data-testid={`sev-${impact}`}>
                {byImpact[impact]}
              </td>
              <td className="num share">{total ? `${Math.round((byImpact[impact] / total) * 100)}%` : '–'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('total')}</th>
            <td className="num">{total}</td>
            <td className="num share">{total ? '100%' : '–'}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

const CHECK_TITLE = { altText: 'checkAltText', contrast: 'checkContrast', label: 'checkLabel' };

/** US-09: the measured colours of one low-contrast element. */
function ContrastDetails({ contrast }) {
  const { t } = useI18n();
  return (
    <div className="node-extra contrast-detail">
      <dl className="contrast-colors">
        <div>
          <dt>{t('contrastText')}</dt>
          <dd>
            <span className="color-chip" style={{ background: contrast.foreground }} aria-hidden="true" />
            <code dir="ltr">{contrast.foreground}</code>
          </dd>
        </div>
        <div>
          <dt>{t('contrastBackground')}</dt>
          <dd>
            <span className="color-chip" style={{ background: contrast.background }} aria-hidden="true" />
            <code dir="ltr">{contrast.background}</code>
          </dd>
        </div>
      </dl>
      <p className="contrast-ratio" data-testid="contrast-ratio">
        {contrast.ratio !== null && contrast.required !== null
          ? t('contrastRatio', { ratio: contrast.ratio, required: contrast.required })
          : t('contrastUnknown')}
        {contrast.fontSize && ` ${t('contrastFont', { size: contrast.fontSize, weight: contrast.fontWeight ?? '' })}`}
      </p>
    </div>
  );
}

/** US-08 and US-11: a suggested text and code for one element. The page itself is never changed. */
function Suggestion({ suggestion, category }) {
  const { t } = useI18n();
  const title = category === 'altText' ? t('suggestAlt') : suggestion.kind === 'name' ? t('suggestName') : t('suggestLabel');
  return (
    <div className="node-extra suggestion">
      <p className="suggestion-head">
        <strong>{title}</strong>{' '}
        {suggestion.text && (
          <bdi className="suggestion-text" data-testid="suggestion-text">
            {suggestion.text}
          </bdi>
        )}
      </p>
      <p className="suggestion-basis">{suggestion.text ? t(`basis_${suggestion.basis}`) : t('suggestNoText')}</p>
      {suggestion.code && (
        <>
          <p className="suggestion-code-label">{t('suggestCode')}</p>
          <pre className="node-html suggestion-code" dir="ltr">
            <code>{suggestion.code}</code>
          </pre>
        </>
      )}
    </div>
  );
}

function Violation({ violation }) {
  const { t, count } = useI18n();
  const hasSuggestions = violation.nodes.some((node) => node.suggestion);
  return (
    <li className="violation">
      <div className="violation-head">
        <h4 dir="ltr">{violation.help}</h4>
        <Impact impact={violation.impact} />
      </div>
      <p className="violation-meta">
        {t('elementsAffected', { elements: count(violation.nodeCount, 'element'), rule: '' })}
        <code>{violation.id}</code>
        {violation.wcag.length > 0 && t('wcagTags', { tags: violation.wcag.join(', ') })}.
      </p>
      <p dir="ltr">{violation.description}</p>
      <ul className="nodes">
        {violation.nodes.map((node, index) => (
          <li key={`${node.target}-${index}`}>
            <code className="node-target">{node.target}</code>
            <pre className="node-html">
              <code>{node.html}</code>
            </pre>
            {node.contrast && <ContrastDetails contrast={node.contrast} />}
            {node.suggestion && <Suggestion suggestion={node.suggestion} category={violation.category} />}
          </li>
        ))}
      </ul>
      {violation.nodeCount > violation.nodes.length && (
        <p className="violation-more">
          {t('showing', { shown: violation.nodes.length, total: violation.nodeCount })}
        </p>
      )}
      {hasSuggestions && <p className="suggestion-note">{t('suggestNote')}</p>}
      <a href={violation.helpUrl} target="_blank" rel="noopener noreferrer">
        {t('howToFix')}
        <span className="visually-hidden"> {t('newTab')}</span>
      </a>
    </li>
  );
}

/** US-07, US-09 and US-10 at a glance: how many elements fail each check across the website. */
function KeyChecks({ checks }) {
  const { t, count } = useI18n();
  return (
    <section className="panel checks" aria-labelledby="checks-title">
      <header className="panel-head">
        <h2 id="checks-title">{t('checksTitle')}</h2>
        <p className="meta">{t('checksHint')}</p>
      </header>
      <ul className="check-list">
        {CHECKS.map((check) => {
          const { elements, suggestions, lowestRatio } = checks[check];
          let detail = t('checkNone');
          if (elements > 0) {
            detail =
              check === 'contrast'
                ? lowestRatio !== null
                  ? t('checkLowest', { ratio: lowestRatio })
                  : ''
                : t('checkSuggestions', { suggestions: count(suggestions, 'suggestion') });
          }
          return (
            <li key={check} className={`check${elements === 0 ? ' is-zero' : ''}`}>
              <span className="check-name">{t(CHECK_TITLE[check])}</span>
              <span className="check-figure num" data-testid={`check-${check}`}>
                {elements}
              </span>
              <span className="check-detail">{detail}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SeverityCells({ counts }) {
  const { impact: impactLabel } = useI18n();
  return IMPACTS.map((impact) => (
    <span key={impact} className={`cell num${counts && counts[impact] === 0 ? ' is-zero' : ''}`}>
      {counts ? counts[impact] : '–'}
      <span className="visually-hidden"> {impactLabel(impact)}</span>
    </span>
  ));
}

function severityText(counts, { t, impact: impactLabel, lang }) {
  const parts = IMPACTS.filter((impact) => counts[impact] > 0).map((impact) => `${counts[impact]} ${impactLabel(impact)}`);
  return parts.length ? parts.join(lang === 'ar' ? '، ' : ', ') : t('noIssues');
}

export function Report({ scan, headingRef, onNewScan, onScanAgain }) {
  const i18n = useI18n();
  const { t, count, impact: impactLabel, lang } = i18n;
  const { report } = scan;
  const summary = useMemo(() => summarizeReport(report), [report]);
  const rowRefs = useRef(new Map());
  const host = displayHost(report.url);
  const { topRule, counts } = summary;

  function showPage(page) {
    const row = rowRefs.current.get(page.url);
    if (!row) return;
    if (row.tagName === 'DETAILS') row.open = true;
    row.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    row.querySelector('summary, .row-main')?.focus();
  }

  return (
    <article className="report" aria-labelledby="report-title">
      <div className="title-row">
        <div>
          <h1 id="report-title" ref={headingRef} tabIndex={-1}>
            <span className="visually-hidden">{t('reportFor')}</span> <span dir="ltr">{host}</span>
          </h1>
          <p className="sub">
            <a href={report.url} target="_blank" rel="noopener noreferrer" className="url">
              {report.url}
            </a>
            <span className="stamp">
              {t('started', {
                start: formatTime(report.startedAt, lang),
                end: formatTime(report.finishedAt, lang),
                duration: formatDuration(report.startedAt, report.finishedAt, lang),
              })}
            </span>
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={onNewScan}>
            {t('scanAnother')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onScanAgain(report.url)}>
            {t('scanAgain')}
          </button>
        </div>
      </div>

      <p className="finding">
        {topRule ? (
          <>
            <strong>{t('fixFirst')}</strong> <bdi>{topRule.help}</bdi>
            {t('fixFirstText', {
              impact: impactLabel(topRule.impact),
              elements: count(topRule.elements, 'element'),
              pages: count(topRule.pages, 'page'),
            }).replace('{rule}', '')}
          </>
        ) : (
          <>{t('noIssuesFinding', { pages: count(counts.scanned, 'scannedPage') })}</>
        )}
      </p>

      {report.limitsReached.map((limit) => (
        <p key={limit.type} className="notice-warning">
          <strong>{t('partial')}</strong> {i18n.limit(limit, scan.limits)}
        </p>
      ))}

      <div className="grid overview">
        <section className="panel" aria-labelledby="issues-title">
          <header className="panel-head">
            <h2 id="issues-title">{t('issuesTitle')}</h2>
            <p className="meta">{t('affected')}</p>
          </header>
          <p className="answer">
            <span className="answer-figure num" data-testid="total-issues">
              {summary.issues}
            </span>{' '}
            <span className="answer-unit">{i18n.unit(summary.issues, 'issue')}</span>
          </p>
          <p className="answer-sub">
            {t('onPages', { n: summary.pagesWithIssues, pages: count(counts.scanned, 'scannedPage') })}
          </p>
          <SeverityBreakdown byImpact={summary.byImpact} total={summary.issues} />
        </section>

        <section className="panel" aria-labelledby="rules-title">
          <header className="panel-head">
            <h2 id="rules-title">{t('rulesTitle')}</h2>
            <p className="meta">{count(summary.rules.length, 'rule')}</p>
          </header>
          {summary.rules.length === 0 ? (
            <p className="empty-line">{t('noRules')}</p>
          ) : (
            <ol className="rule-list">
              {summary.rules.slice(0, MAX_RULES).map((rule, index) => (
                <li key={rule.id}>
                  <div className="rule-line">
                    <span className="rule-name" dir="ltr">
                      {rule.help}
                    </span>
                    <span className="num rule-value">{rule.elements}</span>
                  </div>
                  <div className="rule-bar" aria-hidden="true">
                    <span
                      className={index === 0 ? 'lead' : ''}
                      style={{ width: `${Math.max(4, (rule.elements / summary.rules[0].elements) * 88)}%` }}
                    />
                  </div>
                  <p className="rule-meta">
                    {t('ruleMeta', { impact: impactLabel(rule.impact), pages: count(rule.pages, 'page') })}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {summary.rules.length > MAX_RULES && (
            <p className="rule-more">{t('moreRules', { n: summary.rules.length - MAX_RULES })}</p>
          )}
        </section>

        <section className="panel" aria-labelledby="map-title">
          <header className="panel-head">
            <h2 id="map-title">{t('pagesTitle')}</h2>
            <p className="meta">{t('selectPage')}</p>
          </header>
          <PageMap pages={report.pages} label={t('pagesOnSite')} onSelect={showPage} />
          <PageMapLegend pages={report.pages} />
          <dl className="kv tally">
            <div>
              <dt>{t('tallyFound')}</dt>
              <dd className="num" data-testid="total-discovered">
                {counts.found}
              </dd>
            </div>
            <div>
              <dt>{t('tallyScanned')}</dt>
              <dd className="num" data-testid="total-succeeded">
                {counts.scanned}
              </dd>
            </div>
            <div>
              <dt>{t('tallyFailed')}</dt>
              <dd className="num" data-testid="total-failed">
                {counts.failed}
              </dd>
            </div>
            <div>
              <dt>{t('tallySkipped')}</dt>
              <dd className="num" data-testid="total-skipped">
                {counts.skipped}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <KeyChecks checks={summary.checks} />

      <section className="panel pages" aria-labelledby="pages-title">
        <header className="panel-head">
          <h2 id="pages-title">{t('byPage')}</h2>
          <p className="meta">{t('byPageHint')}</p>
        </header>

        <div className="page-grid page-grid-head" aria-hidden="true">
          <span className="cell-page">{t('colPage')}</span>
          {IMPACTS.map((impact) => (
            <span key={impact} className="cell num">
              {impactLabel(impact)}
            </span>
          ))}
          <span className="cell num">{t('colIssues')}</span>
        </div>

        <ul className="page-rows">
          {summary.pages.map((page) => (
            <li key={page.url}>
              <details ref={(node) => (node ? rowRefs.current.set(page.url, node) : rowRefs.current.delete(page.url))}>
                <summary className="page-grid">
                  <span className="cell-page">
                    <PageTile kind={tileKind(page)} small />
                    <span className="page-lines">
                      <span className="page-path">{displayPath(page.url)}</span>
                      <span className="sev-inline" aria-hidden="true">
                        {severityText(page.counts, i18n)}
                      </span>
                    </span>
                  </span>
                  <SeverityCells counts={page.counts} />
                  <span className={`cell num total${page.issueCount === 0 ? ' is-clean' : ''}`}>
                    {page.issueCount === 0 ? t('none') : page.issueCount}
                    <span className="visually-hidden"> {t('colIssues')}</span>
                  </span>
                </summary>
                <div className="page-body">
                  <p className="page-link">
                    <a href={page.finalUrl} target="_blank" rel="noopener noreferrer">
                      {t('open', { path: displayPath(page.url) })}
                      <span className="visually-hidden"> {t('newTab')}</span>
                    </a>
                  </p>
                  {page.violations.length === 0 ? (
                    <p>{t('pageClean')}</p>
                  ) : (
                    <ul className="violations">
                      {page.violations.map((violation) => (
                        <Violation key={violation.id} violation={violation} />
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            </li>
          ))}

          {[...summary.failed, ...summary.skipped].map((page) => (
            <li key={page.url}>
              <div
                className={`page-grid row-${page.status}`}
                ref={(node) => (node ? rowRefs.current.set(page.url, node) : rowRefs.current.delete(page.url))}
              >
                <span className="cell-page row-main" tabIndex={-1}>
                  <PageTile kind={tileKind(page)} small text={page.status === 'failed' ? '!' : '–'} />
                  <span>
                    <span className="page-path">{displayPath(page.url)}</span>
                    <span className="row-reason">
                      {page.status === 'failed'
                        ? `${t('couldNotScan')} ${i18n.error(page.error)}`
                        : `${t('skippedRow')} ${i18n.note(page.note)}`}
                    </span>
                  </span>
                </span>
                <SeverityCells counts={null} />
                <span className="cell num">–</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}