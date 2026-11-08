import { describe, expect, it } from 'vitest';
import { categoryOf, contrastDetails, needsContext, nodeDetails } from '../../src/scanner/findings.js';
import { summarizeViolations } from '../../src/scanner/pageScanner.js';

const contrastNode = {
  target: ['.faint'],
  html: '<p class="faint">Fresh bread</p>',
  failureSummary: 'Fix any of the following: Element has insufficient color contrast of 1.91',
  any: [
    {
      id: 'color-contrast',
      data: {
        fgColor: '#bbbbbb',
        bgColor: '#ffffff',
        contrastRatio: 1.9145,
        fontSize: '12.0pt (16px)',
        fontWeight: 'normal',
        expectedContrastRatio: '4.5:1',
      },
    },
  ],
  all: [],
  none: [],
};

describe('Sprint 2 check categories', () => {
  it('groups axe-core rules into the three checks', () => {
    expect(categoryOf('image-alt')).toBe('altText');
    expect(categoryOf('svg-img-alt')).toBe('altText');
    expect(categoryOf('color-contrast')).toBe('contrast');
    expect(categoryOf('label')).toBe('label');
    expect(categoryOf('button-name')).toBe('label');
    expect(categoryOf('html-has-lang')).toBeNull();
  });

  it('asks for page context only where a suggestion is made', () => {
    expect(needsContext('image-alt')).toBe(true);
    expect(needsContext('label')).toBe(true);
    expect(needsContext('color-contrast')).toBe(false);
    expect(needsContext('region')).toBe(false);
  });
});

describe('contrast details (US-09)', () => {
  it('reads the colours, the ratio and the required ratio', () => {
    expect(contrastDetails(contrastNode)).toEqual({
      foreground: '#bbbbbb',
      background: '#ffffff',
      ratio: 1.91,
      required: 4.5,
      fontSize: '12.0pt (16px)',
      fontWeight: 'normal',
    });
  });

  it('returns null when axe-core could not measure the colours', () => {
    expect(contrastDetails({ any: [{ id: 'color-contrast', data: { messageKey: 'bgImage' } }] })).toBeNull();
    expect(contrastDetails({})).toBeNull();
  });

  it('adds nothing to rules outside the three checks', () => {
    expect(nodeDetails('region', contrastNode, {})).toEqual({});
  });
});

describe('summarizeViolations with Sprint 2 details', () => {
  const violations = [
    {
      id: 'color-contrast',
      impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA thresholds',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
      tags: ['cat.color', 'wcag2aa', 'wcag143'],
      nodes: [contrastNode],
    },
    {
      id: 'image-alt',
      impact: 'critical',
      help: 'Images must have alternative text',
      description: 'Ensures <img> elements have alternative text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
      tags: ['wcag2a', 'wcag111'],
      nodes: [
        { target: ['img.a'], html: '<img class="a" src="logo.png">', failureSummary: '' },
        { target: ['iframe', 'img'], html: '<img src="x.png">', failureSummary: '' },
      ],
    },
  ];
  const contexts = new Map([['img.a', { tag: 'img', src: '/img/logo.png', pageTitle: 'Bakery – Home' }]]);
  const [contrast, images] = summarizeViolations(violations, contexts);

  it('keeps the Sprint 1 fields', () => {
    expect(contrast).toMatchObject({ id: 'color-contrast', nodeCount: 1, wcag: ['wcag2aa', 'wcag143'] });
    expect([contrast.category, images.category]).toEqual(['contrast', 'altText']);
    expect(contrast.nodes[0]).toMatchObject({ target: '.faint', html: '<p class="faint">Fresh bread</p>' });
  });

  it('adds the measured contrast to each contrast element', () => {
    expect(contrast.nodes[0].contrast).toMatchObject({ ratio: 1.91, required: 4.5 });
  });

  it('links each suggestion to its own image', () => {
    expect(images.nodes[0].suggestion).toMatchObject({ text: 'Bakery logo', basis: 'fileName' });
    expect(images.nodes[0].suggestion.code).toContain('class="a"');
    // No page context for an image inside a frame: the suggestion still names the image, without text.
    expect(images.nodes[1].suggestion).toMatchObject({ text: null, basis: 'none' });
    expect(images.nodes[1].suggestion.code).toBe('<img alt="Describe what the image shows" src="x.png">');
  });
});