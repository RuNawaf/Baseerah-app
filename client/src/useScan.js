import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getScan, startScan } from './api.js';
import { displayHost } from './format.js';
import { validateUrl } from './validateUrl.js';

const FINISHED = new Set(['completed', 'completed_with_errors', 'failed']);
const MAX_POLL_RETRIES = 3;

/**
 * Drives one scan from submission to result.
 * phase: idle → starting → scanning → done | failed
 */
export function useScan({ pollIntervalMs = 1000, i18n } = {}) {
  const [phase, setPhase] = useState('idle');
  const [inputError, setInputError] = useState(null);
  const [scan, setScan] = useState(null);
  const [failure, setFailure] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const retries = useRef(0);
  // Announcements are written in the language shown when they happen.
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;
  const tr = (key, vars) => i18nRef.current?.t(key, vars) ?? key;

  const submit = useCallback(async (rawUrl) => {
    const checked = validateUrl(rawUrl);
    if (checked.code) {
      setInputError(checked);
      return false;
    }

    setInputError(null);
    setFailure(null);
    setScan(null);
    setPhase('starting');
    setAnnouncement(tr('announceChecking'));

    try {
      const created = await startScan(rawUrl.trim());
      retries.current = 0;
      setScan(created);
      setPhase('scanning');
      setAnnouncement(tr('announceStarted', { host: displayHost(created.url) }));
      return true;
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError('INTERNAL_ERROR', 'Something went wrong. Try again.');
      // Validation and availability problems belong next to the URL field so it can be corrected.
      setInputError({ code: error.code, message: error.message });
      setPhase('idle');
      setAnnouncement('');
      return false;
    }
  }, []);

  useEffect(() => {
    if (phase !== 'scanning' || !scan?.scanId) return undefined;
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const latest = await getScan(scan.scanId);
        if (cancelled) return;
        retries.current = 0;
        setScan(latest);
        if (!FINISHED.has(latest.status)) return;

        if (latest.status === 'failed') {
          setFailure(latest.error);
          setPhase('failed');
          setAnnouncement(tr('announceFailed', { message: i18nRef.current?.error(latest.error) ?? '' }).trim());
        } else {
          const { totals } = latest.report;
          setPhase('done');
          setAnnouncement(
            tr('announceDone', {
              pages: i18nRef.current.count(totals.succeededPages, 'page'),
              issues: i18nRef.current.count(totals.issues, 'accessibilityIssue'),
            }),
          );
        }
      } catch (err) {
        if (cancelled) return;
        retries.current += 1;
        if (err.code === 'SCAN_NOT_FOUND' || retries.current > MAX_POLL_RETRIES) {
          setFailure({ code: err.code, message: err.message });
          setPhase('failed');
          setAnnouncement(tr('announceFailed', { message: i18nRef.current?.error(err) ?? err.message }));
        } else {
          setScan((current) => ({ ...current })); // schedule another attempt
        }
      }
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, scan, pollIntervalMs]);

  /** Reopens a scan by ID (from a #/report/... link): shows its report, resumes polling, or explains why not. */
  const resume = useCallback(async (scanId) => {
    try {
      const latest = await getScan(scanId);
      setScan(latest);
      if (latest.status === 'failed') {
        setFailure(latest.error);
        setPhase('failed');
      } else if (latest.report) {
        setPhase('done');
      } else {
        setPhase('scanning');
      }
      return latest;
    } catch (err) {
      setFailure({ code: err.code, message: err.message });
      setPhase('failed');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setScan(null);
    setFailure(null);
    setInputError(null);
    setAnnouncement('');
  }, []);

  return { phase, inputError, scan, failure, announcement, submit, resume, reset, clearInputError: () => setInputError(null) };
}