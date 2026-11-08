import { describe, expect, it } from 'vitest';
import { fileNameWords, siteNameFrom, suggestAltText, suggestLabel, withAttribute } from '../../src/scanner/suggestions.js';

describe('alternative-text suggestions (US-08)', () => {
  it('describes a logo with the site name from the page title', () => {
    const suggestion = suggestAltText({
      tag: 'img',
      src: 'https://bakery.example/img/logo.png',
      pageTitle: 'Fixture Bakery – Home',
      html: '<img src="img/logo.png" width="64">',
    });
    expect(suggestion).toMatchObject({ text: 'Fixture Bakery logo', basis: 'fileName', attribute: 'alt' });
    expect(suggestion.code).toBe('<img alt="Fixture Bakery logo" src="img/logo.png" width="64">');
  });

  it('uses the destination when the image is the whole link', () => {
    expect(suggestAltText({ linkHref: '/about-us.html', linkText: '', src: 'a.png' })).toMatchObject({ text: 'About us', basis: 'link' });
    expect(suggestAltText({ linkHref: '/', linkText: '' }).text).toBe('Home');
    expect(suggestAltText({ linkHref: '/x', linkText: '', linkLabel: 'Our menu' }).text).toBe('Our menu');
  });

  it('prefers a figure caption, then the title attribute', () => {
    expect(suggestAltText({ caption: '  Our sourdough   loaf ', title: 'Bread' })).toMatchObject({ text: 'Our sourdough loaf', basis: 'caption' });
    expect(suggestAltText({ title: 'Bread basket' })).toMatchObject({ text: 'Bread basket', basis: 'title' });
  });

  it('turns a meaningful file name into words', () => {
    expect(suggestAltText({ src: '/uploads/team-photo_riyadh-2024@2x.jpg' }).text).toBe('Team riyadh');
    expect(fileNameWords('/img/freshBread.webp')).toEqual(['fresh', 'Bread']);
  });

  it('gives no text when nothing on the page describes the image', () => {
    for (const src of ['/img/IMG_2041.jpg', '/a8f3c9e1b2d4e5f6.png', 'data:image/png;base64,AAAA', '']) {
      const suggestion = suggestAltText({ src, html: '<img src="x">' });
      expect(suggestion.text).toBeNull();
      expect(suggestion.basis).toBe('none');
      expect(suggestion.code).toBe('<img alt="Describe what the image shows" src="x">');
    }
  });

  it('suggests aria-label for elements that are not img, area or input', () => {
    const suggestion = suggestAltText({ tag: 'svg', title: 'Chart of sales', html: '<svg role="img"></svg>' });
    expect(suggestion.attribute).toBe('aria-label');
    expect(suggestion.code).toBe('<svg aria-label="Chart of sales" role="img"></svg>');
  });

  it('escapes quotes in the suggested code', () => {
    expect(suggestAltText({ caption: 'The "best" bread', html: '<img src="b.png">' }).code).toBe(
      '<img alt="The &quot;best&quot; bread" src="b.png">',
    );
  });
});

describe('accessible-label suggestions (US-11)', () => {
  it('labels a field from the visible text next to it', () => {
    expect(suggestLabel({ tag: 'input', type: 'tel', name: 'phone', nearbyText: 'Phone:' })).toMatchObject({ text: 'Phone', basis: 'nearbyText' });
  });

  it('labels a field from its placeholder, autocomplete or type', () => {
    expect(suggestLabel({ tag: 'input', placeholder: 'Your company' })).toMatchObject({ text: 'Your company', basis: 'placeholder' });
    expect(suggestLabel({ tag: 'input', autocomplete: 'shipping given-name' })).toMatchObject({ text: 'First name', basis: 'autocomplete' });
    expect(suggestLabel({ tag: 'input', type: 'email', name: 'x1' })).toMatchObject({ text: 'Email address', basis: 'inputType' });
  });

  it('labels a field from its name or id', () => {
    expect(suggestLabel({ tag: 'input', name: 'first_name' }).text).toBe('First name');
    expect(suggestLabel({ tag: 'input', name: 'q' }).text).toBe('Search');
    expect(suggestLabel({ tag: 'select', id: 'deliveryWindow' }).text).toBe('Delivery window');
    expect(suggestLabel({ tag: 'input', name: 'first_name' }).basis).toBe('fieldName');
  });

  it('suggests a <label> linked to the field', () => {
    expect(suggestLabel({ tag: 'input', type: 'email', name: 'email', html: '<input type="email" name="email">' }).code).toBe(
      '<label for="email">Email address</label>\n<input id="email" type="email" name="email">',
    );
    expect(suggestLabel({ tag: 'input', id: 'q', html: '<input id="q">' }).code).toBe('<label for="q">Search</label>\n<input id="q">');
  });

  it('falls back to aria-label when the field has no name or id', () => {
    const suggestion = suggestLabel({ tag: 'input', type: 'search', html: '<input type="search">' });
    expect(suggestion.code).toBe('<input aria-label="Search" type="search">');
  });

  it('names an icon-only button from its icon', () => {
    const suggestion = suggestLabel({ tag: 'button', iconHint: 'icon-search', html: '<button><svg></svg></button>' });
    expect(suggestion).toMatchObject({ text: 'Search', basis: 'icon', kind: 'name' });
    expect(suggestion.code).toBe('<button aria-label="Search"><svg></svg></button>');
    expect(suggestLabel({ tag: 'button', className: 'btn hamburger' }).text).toBe('Open menu');
    expect(suggestLabel({ tag: 'button', svgTitle: 'Close dialog' })).toMatchObject({ text: 'Close dialog', basis: 'icon' });
  });

  it('names a submit button and an input button', () => {
    expect(suggestLabel({ tag: 'button', type: 'submit' })).toMatchObject({ text: 'Submit', basis: 'buttonType' });
    expect(suggestLabel({ tag: 'input', type: 'submit', html: '<input type="submit">' }).code).toBe('<input value="Submit" type="submit">');
  });

  it('gives no text for a button with no clues', () => {
    const suggestion = suggestLabel({ tag: 'button', type: 'button', html: '<button type="button"></button>' });
    expect(suggestion.text).toBeNull();
    expect(suggestion.code).toBe('<button aria-label="Describe what the button does" type="button"></button>');
  });
});

describe('helpers', () => {
  it('reads the site name from a page title', () => {
    expect(siteNameFrom('Fixture Bakery – Home')).toBe('Fixture Bakery');
    expect(siteNameFrom('Home | KSU')).toBe('Home');
    expect(siteNameFrom('')).toBe('');
  });

  it('adds an attribute to the first tag only', () => {
    expect(withAttribute('<img src="a"><img src="b">', 'alt', 'A')).toBe('<img alt="A" src="a"><img src="b">');
    expect(withAttribute('not html', 'alt', 'A')).toBe('not html');
  });
});