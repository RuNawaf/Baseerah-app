import { useEffect, useRef, useState } from 'react';
import { displayHost } from './format.js';

const RESULT_TITLE_KEYS = ['titleDone', 'titleFailed'];
const ICON = '/favicon-64.png';

export function notificationPermission() {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported';
}

/** Must be called from a click/submit handler: browsers only show the prompt after a user action. */
export function requestNotificationPermission() {
  if (notificationPermission() !== 'default') return Promise.resolve(notificationPermission());
  try {
    return Promise.resolve(window.Notification.requestPermission()).catch(() => 'denied');
  } catch {
    return Promise.resolve('denied');
  }
}

function describe(phase, scan, failure, { t, count, error }) {
  if (phase === 'done') {
    const { totals } = scan.report;
    return {
      title: t('doneTitle'),
      tabTitle: t('titleDone'),
      body: t('notifyDoneBody', {
        host: displayHost(scan.url),
        pages: count(totals.succeededPages, 'page'),
        issues: count(totals.issues, 'accessibilityIssue'),
      }),
    };
  }
  return { title: t('notifyFailedTitle'), tabTitle: t('titleFailed'), body: failure ? error(failure) : t('notifyFailedBody') };
}

/**
 * Tells the developer when a scan ends, even if they switched to another tab:
 * - a system notification (if allowed), which brings this tab back and opens the report when clicked
 * - the tab title shows live progress while scanning and the result afterwards, until the tab is viewed again
 */
export function useCompletionAlert({ phase, scan, failure, onOpenReport, i18n }) {
  const notifiedScanId = useRef(null);
  const notificationRef = useRef(null);
  const openReportRef = useRef(onOpenReport);
  openReportRef.current = onOpenReport;
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;
  const baseTitle = i18n.t('pageTitle');
  const [permission, setPermission] = useState(notificationPermission);

  // Coming back to the tab clears the result from the title and dismisses the notification.
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      const { t } = i18nRef.current;
      if (RESULT_TITLE_KEYS.some((key) => document.title === t(key))) document.title = t('pageTitle');
      notificationRef.current?.close();
      notificationRef.current = null;
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Live progress in the tab title.
  useEffect(() => {
    const { t } = i18nRef.current;
    if (phase === 'scanning' && scan) {
      const { progress } = scan;
      const done = (progress?.succeeded ?? 0) + (progress?.failed ?? 0) + (progress?.skipped ?? 0);
      document.title = progress?.discovered ? t('titleScanning', { done, total: progress.discovered }) : t('titleScanningStart');
    } else if (phase === 'idle' || phase === 'starting' || !document.hidden) {
      document.title = baseTitle;
    }
  }, [phase, scan, baseTitle]);

  // Result: notification and tab title, once per scan.
  useEffect(() => {
    if ((phase !== 'done' && phase !== 'failed') || !scan || notifiedScanId.current === scan.scanId) return;
    notifiedScanId.current = scan.scanId;

    if (!document.hidden) {
      document.title = i18nRef.current.t('pageTitle'); // the on-page notice is enough
      return;
    }

    const message = describe(phase, scan, failure, i18nRef.current);
    document.title = message.tabTitle;
    if (notificationPermission() !== 'granted') return;

    try {
      const notification = new window.Notification(message.title, {
        body: message.body,
        icon: ICON,
        tag: `baseerah-${scan.scanId}`,
      });
      notification.onclick = () => {
        window.focus();
        if (phase === 'done') openReportRef.current?.();
        notification.close();
      };
      notificationRef.current = notification;
    } catch {
      // Some browsers (e.g. Android Chrome) only allow notifications from a service worker; the tab title still works.
    }
  }, [phase, scan, failure]);

  return {
    permission,
    async ask() {
      setPermission(await requestNotificationPermission());
    },
  };
}