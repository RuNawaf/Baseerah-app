import { suggestAltText, suggestLabel } from './suggestions.js';

// The axe-core rules behind each Sprint 2 check.
export const CATEGORY_RULES = {
  altText: ['image-alt', 'input-image-alt', 'area-alt', 'role-img-alt', 'svg-img-alt', 'object-alt'], // US-07
  contrast: ['color-contrast', 'color-contrast-enhanced'], // US-09
  label: ['label', 'button-name', 'input-button-name', 'select-name', 'aria-input-field-name', 'aria-toggle-field-name'], // US-10
};

const RULE_CATEGORY = new Map(
  Object.entries(CATEGORY_RULES).flatMap(([category, rules]) => rules.map((rule) => [rule, category])),
);

export function categoryOf(ruleId) {
  return RULE_CATEGORY.get(ruleId) ?? null;
}

/** Rules whose elements need page context for a suggestion. */
export function needsContext(ruleId) {
  const category = categoryOf(ruleId);
  return category === 'altText' || category === 'label';
}

function parseRatio(value) {
  if (typeof value === 'number') return value;
  const match = /([\d.]+)\s*:\s*1/.exec(String(value ?? ''));
  return match ? Number(match[1]) : null;
}

function round(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/**
 * US-09. axe-core stores the measured colours on the check that failed.
 * Returns null when axe could not measure them (for example text over an image).
 */
export function contrastDetails(node) {
  const checks = [...(node.any ?? []), ...(node.all ?? []), ...(node.none ?? [])];
  const data = checks.map((check) => check.data).find((value) => value && value.fgColor && value.bgColor);
  if (!data) return null;
  return {
    foreground: data.fgColor,
    background: data.bgColor,
    ratio: round(data.contrastRatio),
    required: parseRatio(data.expectedContrastRatio),
    fontSize: data.fontSize ?? null,
    fontWeight: data.fontWeight ?? null,
  };
}

/** Extra information for one affected element, by check: measured colours, or a suggestion. */
export function nodeDetails(ruleId, node, context) {
  const category = categoryOf(ruleId);
  if (category === 'contrast') {
    const contrast = contrastDetails(node);
    return contrast ? { contrast } : {};
  }
  if (category === 'altText') {
    return { suggestion: suggestAltText({ ...context, html: node.html }) };
  }
  if (category === 'label') {
    return { suggestion: suggestLabel({ ...context, html: node.html }) };
  }
  return {};
}