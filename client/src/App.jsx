import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHealth } from './api.js';
import { useCompletionAlert } from './completionAlert.js';
import { CompletionNotice } from './components/CompletionNotice.jsx';
import { FailureNotice } from './components/FailureNotice.jsx';
import { Masthead } from './components/Masthead.jsx';
import { Report } from './components/Report.jsx';
import { Hero } from './components/Hero.jsx';
import { ScanAbout } from './components/ScanAbout.jsx';
import { Statement } from './components/Statement.jsx';
import { ScanProgress } from './components/ScanProgress.jsx';
import { I18nContext, makeI18n } from './i18n.js';
import { useScan } from './useScan.js';
import { validateUrl } from './validateUrl.js';

const REPORT_HASH = /^#\/report\/([0-9a-f-]{36})$/i;

const LANG_KEY = 'baseerah-lang';

// The chosen language is a per-browser convenience; storage may be unavailable (private mode), so it is optional.
function initialLanguage() {
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

function reportIdFromHash() {
  return window.location.hash.match(REPORT_HASH)?.[1] ?? null;
}

export default function App({ pollIntervalMs = 1000 }) {
  const [lang, setLang] = useState(initialLanguage);
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  const { t } = i18n;
  const { phase, inputError, scan, failure, announcement, submit, resume, reset, clearInputError } = useScan({
    pollIntervalMs,
    i18n,
  });
  const [url, setUrl] = useState('');
  const [view, setView] = useState('scan');
  const [limits, setLimits] = useState(null);
  const inputRef = useRef(null);
  const reportHeadingRef = useRef(null);
  const noticeRef = useRef(null);
  const scanIdRef = useRef(null);
  scanIdRef.current = scan?.scanId ?? null;

  const busy = phase === 'starting' || phase === 'scanning';

  // The report has its own address (#/report/<id>), so it survives a reload and can be shared while the scan is kept.
  const openReport = useCallback(() => {
    if (scanIdRef.current) window.location.hash = `#/report/${scanIdRef.current}`;
    setView('report');
  }, []);
  const completionAlert = useCompletionAlert({ phase, scan, failure, onOpenReport: openReport, i18n });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = i18n.dir;
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang, i18n.dir]);

  function toggleLanguage() {
    setLang((current) => (current === 'ar' ? 'en' : 'ar'));
  }

  useEffect(() => {
    getHealth()
      .then((health) => setLimits(health.limits ?? null))
      .catch(() => setLimits(null));

    const id = reportIdFromHash();
    if (id) {
      resume(id).then((latest) => {
        if (latest?.report) setView('report');
      });
    }

    const onHashChange = () => {
      if (reportIdFromHash()) return;
      setView('scan');
      // In-page links such as #how may point at a section that only exists once the scan view is back.
      const target = window.location.hash.length > 1 && document.getElementById(window.location.hash.slice(1));
      requestAnimationFrame(() => (target || document.getElementById(window.location.hash.slice(1)))?.scrollIntoView?.());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [resume]);

  // Sections rise once as they scroll into view. Without script, or with reduced motion, they are simply shown.
  useEffect(() => {
    if (view !== 'scan' || !('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    document.documentElement.classList.add('js-motion');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [view]);

  // When a scan starts, bring its progress into view; it sits below the first screen.
  useEffect(() => {
    if (phase !== 'scanning' || view !== 'scan') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('.run')?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [phase, view]);

  useEffect(() => {
    if (inputError) inputRef.current?.focus();
  }, [inputError]);

  useEffect(() => {
    if (view === 'scan' && (phase === 'done' || phase === 'failed')) noticeRef.current?.focus();
  }, [phase, view]);

  useEffect(() => {
    if (view === 'report') {
      window.scrollTo?.(0, 0);
      reportHeadingRef.current?.focus();
    }
  }, [view]);

  function scanUrl(target) {
    // Ask while we still have the click: browsers ignore permission prompts that are not tied to a user action.
    if (!validateUrl(target).code) completionAlert.ask();
    submit(target);
  }

  function leaveReport() {
    if (reportIdFromHash()) window.history.pushState(null, '', window.location.pathname + window.location.search);
    setView('scan');
  }

  function goToScanForm() {
    if (view === 'report') leaveReport();
    requestAnimationFrame(() => {
      window.scrollTo?.(0, 0);
      inputRef.current?.focus();
    });
  }

  function startNewScan() {
    leaveReport();
    reset();
    setUrl('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function scanAgain(target) {
    leaveReport();
    setUrl(target);
    scanUrl(target);
  }

  return (
    <I18nContext.Provider value={i18n}>
    <div className="frame">
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <Masthead onHome={startNewScan} onScanClick={goToScanForm} onToggleLanguage={toggleLanguage} />
      <main id="main" className="sheet" tabIndex={-1}>
        {/* Polite status messages for screen readers: scan started, finished, failed. */}
        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        {view === 'report' && scan?.report ? (
          <Report scan={scan} headingRef={reportHeadingRef} onNewScan={startNewScan} onScanAgain={scanAgain} />
        ) : (
          <>
            <Hero
              value={url}
              onChange={(value) => {
                setUrl(value);
                if (inputError) clearInputError();
              }}
              onSubmit={() => scanUrl(url)}
              error={inputError}
              busy={busy}
              phase={phase}
              inputRef={inputRef}
            />

            {(phase === 'done' || phase === 'failed' || (scan && phase === 'scanning')) && (
              <section className="run" aria-label={t('currentScan')} data-ui>
                {phase === 'done' && scan?.report && <CompletionNotice ref={noticeRef} scan={scan} onViewReport={openReport} />}
                {phase === 'failed' && <FailureNotice ref={noticeRef} error={failure} onRetry={() => scanUrl(url)} />}
                {scan && phase !== 'failed' && (
                  <ScanProgress scan={scan} phase={phase} notifications={completionAlert.permission} />
                )}
              </section>
            )}

            <Statement />
            <ScanAbout limits={limits} />
          </>
        )}

        <footer className="sheet-footer">
          <p>
            {t('footer').split('{axe}')[0]}
            <a href="https://github.com/dequelabs/axe-core">axe-core</a>
            {t('footer').split('{axe}')[1]}
          </p>
        </footer>
      </main>
    </div>
    </I18nContext.Provider>
  );
}