// Rule-based suggestions for US-08 (alternative text) and US-11 (accessible labels).
// They are built from what the page already says about the element: a caption, the link around it,
// its file name, the text next to a field, its type or name. Baseerah never changes the page;
// a suggestion is a starting point the developer reviews and edits.

const NOISE_WORDS = new Set([
  'img', 'image', 'images', 'photo', 'pic', 'picture', 'final', 'copy', 'small', 'large', 'thumb', 'thumbnail',
  'min', 'web', 'hd', 'icon', 'new', 'edit', 'scaled', 'cropped', 'original', 'file', 'asset', 'assets',
]);

// Visible field names that mean the same thing, mapped to one clear label.
const FIELD_WORDS = [
  [/^(e-?mail|mail|email-?address)$/, 'Email address'],
  [/^(phone|mobile|tel|telephone|phone-?number|mobile-?number)$/, 'Phone number'],
  [/^(f-?name|first-?name|given-?name)$/, 'First name'],
  [/^(l-?name|last-?name|family-?name|surname)$/, 'Last name'],
  [/^(name|full-?name|your-?name)$/, 'Full name'],
  [/^(q|s|query|search|keyword|keywords|search-?term)$/, 'Search'],
  [/^(message|msg|comment|comments|enquiry|inquiry)$/, 'Message'],
  [/^(user|username|user-?name|login)$/, 'Username'],
  [/^(pass|pwd|password)$/, 'Password'],
  [/^(zip|zip-?code|postal|postal-?code|postcode)$/, 'Postal code'],
  [/^(address|street|street-?address)$/, 'Address'],
  [/^(city|town)$/, 'City'],
  [/^(country)$/, 'Country'],
  [/^(subject|topic)$/, 'Subject'],
  [/^(company|organisation|organization)$/, 'Company'],
  [/^(dob|birthday|birth-?date|date-?of-?birth)$/, 'Date of birth'],
];

const AUTOCOMPLETE_LABELS = {
  email: 'Email address',
  tel: 'Phone number',
  'given-name': 'First name',
  'family-name': 'Last name',
  name: 'Full name',
  username: 'Username',
  'current-password': 'Password',
  'new-password': 'New password',
  'street-address': 'Address',
  'address-line1': 'Address',
  'postal-code': 'Postal code',
  'address-level2': 'City',
  country: 'Country',
  'country-name': 'Country',
  organization: 'Company',
  bday: 'Date of birth',
};

const INPUT_TYPE_LABELS = {
  email: 'Email address',
  tel: 'Phone number',
  password: 'Password',
  search: 'Search',
  url: 'Website address',
  date: 'Date',
  time: 'Time',
};

// Icon names commonly found in class names, file names and SVG ids, and what the button does.
const ICON_WORDS = [
  [/search|magnif/, 'Search'],
  [/close|times|cross|dismiss/, 'Close'],
  [/menu|hamburger|bars|burger|nav-?toggle/, 'Open menu'],
  [/cart|basket|bag|shopping/, 'Shopping cart'],
  [/user|account|profile|person|avatar/, 'Account'],
  [/share/, 'Share'],
  [/next|chevron-?right|arrow-?right|forward/, 'Next'],
  [/prev|chevron-?left|arrow-?left|back/, 'Previous'],
  [/play/, 'Play'],
  [/pause/, 'Pause'],
  [/trash|delete|remove|bin/, 'Delete'],
  [/pencil|edit/, 'Edit'],
  [/gear|cog|settings/, 'Settings'],
  [/filter/, 'Filter'],
  [/download/, 'Download'],
  [/upload/, 'Upload'],
  [/send|paper-?plane/, 'Send'],
  [/heart|like|favou?rite/, 'Add to favourites'],
  [/plus|add/, 'Add'],
  [/minus/, 'Remove'],
  [/home|house/, 'Home'],
  [/phone|call/, 'Call'],
  [/mail|envelope/, 'Email'],
  [/bell|notif/, 'Notifications'],
  [/print/, 'Print'],
  [/help|question/, 'Help'],
  [/info/, 'More information'],
  [/sign-?in|log-?in/, 'Sign in'],
  [/sign-?out|log-?out/, 'Sign out'],
  [/calendar/, 'Calendar'],
  [/expand/, 'Expand'],
  [/collapse/, 'Collapse'],
];

const MAX_TEXT = 120;

function clean(text) {
  if (typeof text !== 'string') return '';
  const value = text.replace(/\s+/g, ' ').trim();
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT - 1).trim()}…` : value;
}

function sentenceCase(words) {
  const text = words.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeAttribute(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Splits "team-photo_2024", "teamPhoto" or "team.photo" into words. */
function splitWords(text) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9؀-ۿ]+/)
    .filter(Boolean);
}

/** The site's name from the page title: "Fixture Bakery – Home" → "Fixture Bakery". */
export function siteNameFrom(title) {
  const first = clean(title).split(/\s[|–—:·-]\s/)[0];
  return clean(first);
}

/** Readable words from an image address, or [] when the file name says nothing useful. */
export function fileNameWords(src) {
  if (!src || src.startsWith('data:')) return [];
  let name;
  try {
    name = new URL(src, 'https://example.invalid/').pathname.split('/').pop() ?? '';
    name = decodeURIComponent(name);
  } catch {
    return [];
  }
  name = name.replace(/\.[a-z0-9]{2,5}$/i, '');
  return splitWords(name).filter((word) => {
    const lower = word.toLowerCase();
    if (NOISE_WORDS.has(lower)) return false;
    if (/^\d+$/.test(word) || /^\d+x\d+$/i.test(word) || /^@?\d+x$/i.test(word) || /^v\d+$/i.test(word)) return false;
    // Hashes and generated ids such as "a8f3c9e1b2" are not words.
    if (word.length > 12 || (/\d/.test(word) && /[a-z]/i.test(word))) return false;
    return true;
  });
}

function pathWords(href) {
  try {
    const url = new URL(href, 'https://example.invalid/');
    const segment = url.pathname.split('/').filter(Boolean).pop();
    if (!segment) return ['Home'];
    return splitWords(decodeURIComponent(segment).replace(/\.[a-z0-9]{2,5}$/i, '')).filter((word) => !/^(index|default)$/i.test(word));
  } catch {
    return [];
  }
}

function matchWords(table, words) {
  for (const [pattern, label] of table) {
    if (words.some((word) => pattern.test(word))) return label;
  }
  return null;
}

/** Adds an attribute to the first tag of an HTML snippet. */
export function withAttribute(html, name, value) {
  const attribute = `${name}="${escapeAttribute(value)}"`;
  if (!/^\s*<[a-z]/i.test(html)) return html;
  return html.replace(/^(\s*<[a-z][\w-]*)/i, `$1 ${attribute}`);
}

/**
 * US-08. Suggests alternative text for an image that has none.
 * `context` comes from the scanned page (see collectElementContext in pageScanner.js).
 */
export function suggestAltText(context = {}) {
  let text = '';
  let basis = 'none';

  if (context.linkHref && !clean(context.linkText)) {
    // The image is the whole link, so its text must say where the link goes.
    text = clean(context.linkLabel) || sentenceCase(pathWords(context.linkHref));
    if (text) basis = 'link';
  }
  if (!text && clean(context.caption)) {
    text = clean(context.caption);
    basis = 'caption';
  }
  if (!text && clean(context.title)) {
    text = clean(context.title);
    basis = 'title';
  }
  if (!text) {
    const words = fileNameWords(context.src);
    if (words.length) {
      const isLogo = words.some((word) => /^logo$/i.test(word));
      const site = siteNameFrom(context.pageTitle);
      text = isLogo && site ? `${site} logo` : sentenceCase(words);
      basis = 'fileName';
    }
  }

  const attribute = /^(img|area|input)$/i.test(context.tag ?? 'img') ? 'alt' : 'aria-label';
  const placeholder = 'Describe what the image shows';
  return {
    text: text || null,
    basis,
    attribute,
    code: context.html ? withAttribute(context.html, attribute, text || placeholder) : null,
  };
}

function isButton(context) {
  const tag = (context.tag ?? '').toLowerCase();
  const type = (context.type ?? '').toLowerCase();
  return tag === 'button' || context.role === 'button' || (tag === 'input' && /^(button|submit|reset|image)$/.test(type));
}

function buttonLabel(context) {
  if (clean(context.title)) return { text: clean(context.title), basis: 'title' };
  if (clean(context.svgTitle)) return { text: clean(context.svgTitle), basis: 'icon' };
  const iconWords = splitWords(`${context.iconHint ?? ''} ${context.className ?? ''}`.toLowerCase());
  const icon = matchWords(ICON_WORDS, iconWords);
  if (icon) return { text: icon, basis: 'icon' };
  const type = (context.type ?? '').toLowerCase();
  if (type === 'submit') return { text: 'Submit', basis: 'buttonType' };
  if (type === 'reset') return { text: 'Reset form', basis: 'buttonType' };
  return { text: '', basis: 'none' };
}

function fieldLabel(context) {
  const nearby = clean(context.nearbyText).replace(/[:*]+$/, '').trim();
  if (nearby) return { text: nearby, basis: 'nearbyText' };
  if (clean(context.placeholder)) return { text: clean(context.placeholder), basis: 'placeholder' };
  const autocomplete = (context.autocomplete ?? '').toLowerCase().split(/\s+/).pop();
  if (AUTOCOMPLETE_LABELS[autocomplete]) return { text: AUTOCOMPLETE_LABELS[autocomplete], basis: 'autocomplete' };
  const type = (context.type ?? '').toLowerCase();
  if (INPUT_TYPE_LABELS[type]) return { text: INPUT_TYPE_LABELS[type], basis: 'inputType' };
  if (clean(context.title)) return { text: clean(context.title), basis: 'title' };
  for (const source of [context.name, context.id]) {
    if (!source) continue;
    const joined = splitWords(source).join('-').toLowerCase();
    const known = matchWords(FIELD_WORDS, [joined]);
    if (known) return { text: known, basis: 'fieldName' };
    const words = splitWords(source).filter((word) => !/^\d+$/.test(word));
    if (words.length) return { text: sentenceCase(words), basis: 'fieldName' };
  }
  return { text: '', basis: 'none' };
}

function idFor(context) {
  if (context.id) return context.id;
  const words = splitWords(context.name ?? '');
  return words.length ? words.join('-').toLowerCase() : null;
}

/**
 * US-11. Suggests an accessible label for a form field, or an accessible name for a button.
 * Fields get a visible <label>; icon-only buttons get aria-label, because they have no visible text.
 */
export function suggestLabel(context = {}) {
  const button = isButton(context);
  const { text, basis } = button ? buttonLabel(context) : fieldLabel(context);
  const value = text || (button ? 'Describe what the button does' : 'Describe what to enter');
  let code = null;

  if (context.html) {
    const type = (context.type ?? '').toLowerCase();
    if (button && (context.tag ?? '').toLowerCase() === 'input' && type !== 'image') {
      code = withAttribute(context.html, 'value', value);
    } else if (button) {
      code = withAttribute(context.html, 'aria-label', value);
    } else {
      const id = idFor(context);
      if (id) {
        const field = context.id ? context.html : withAttribute(context.html, 'id', id);
        code = `<label for="${escapeAttribute(id)}">${escapeText(value)}</label>\n${field}`;
      } else {
        code = withAttribute(context.html, 'aria-label', value);
      }
    }
  }

  return { text: text || null, basis, kind: button ? 'name' : 'label', code };
}