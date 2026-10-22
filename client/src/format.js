export function displayPath(url) {
  try {
    const { pathname, search } = new URL(url);
    return decodeURI(pathname) + search;
  } catch {
    return url;
  }
}

export function displayHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// Arabic keeps Western digits and the Gregorian calendar, matching the numbers elsewhere on the page.
const LOCALES = { en: undefined, ar: 'ar-u-nu-latn-ca-gregory' };
const timeFormats = {};

export function formatTime(iso, lang = 'en') {
  if (!iso) return '—';
  timeFormats[lang] ??= new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'medium', timeStyle: 'medium' });
  return timeFormats[lang].format(new Date(iso));
}

export function formatDuration(startIso, endIso, lang = 'en') {
  if (!startIso || !endIso) return '';
  const seconds = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000));
  const [s, m] = lang === 'ar' ? ['ث', 'د'] : ['s', 'min'];
  if (seconds < 60) return `${seconds} ${s}`;
  return `${Math.floor(seconds / 60)} ${m} ${seconds % 60} ${s}`;
}

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}