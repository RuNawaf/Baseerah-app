export const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

export const IMPACT_LABEL = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };

const IMPACT_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3 };

export const CHECKS = ['altText', 'contrast', 'label'];

/**
 * The Sprint 2 checks across the scanned pages: affected elements, ready suggestions (elements shown with a
 * suggested text) and, for contrast, the lowest measured ratio.
 */
function summarizeChecks(pages) {
  const checks = Object.fromEntries(CHECKS.map((check) => [check, { elements: 0, suggestions: 0, lowestRatio: null }]));
  for (const page of pages) {
    for (const violation of page.violations) {
      const check = checks[violation.category];
      if (!check) continue;
      check.elements += violation.nodeCount;
      for (const node of violation.nodes) {
        if (node.suggestion?.text) check.suggestions += 1;
        const ratio = node.contrast?.ratio;
        if (typeof ratio === 'number' && (check.lowestRatio === null || ratio < check.lowestRatio)) check.lowestRatio = ratio;
      }
    }
  }
  return checks;
}

function emptyCounts() {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

/**
 * Everything the report screen shows, computed from the report's own rows so the figures always agree:
 * the severity split sums to the issue total, and the page counts sum to the pages found.
 */
export function summarizeReport(report) {
  const scanned = report.pages.filter((page) => page.status === 'succeeded');
  const failed = report.pages.filter((page) => page.status === 'failed');
  const skipped = report.pages.filter((page) => page.status === 'skipped');

  const byImpact = emptyCounts();
  const rules = new Map();
  const pages = scanned.map((page) => {
    const counts = emptyCounts();
    for (const violation of page.violations) {
      const impact = IMPACT_RANK[violation.impact] === undefined ? 'minor' : violation.impact;
      counts[impact] += violation.nodeCount;
      byImpact[impact] += violation.nodeCount;

      const rule = rules.get(violation.id) ?? {
        id: violation.id,
        help: violation.help,
        impact,
        helpUrl: violation.helpUrl,
        elements: 0,
        pages: 0,
      };
      rule.elements += violation.nodeCount;
      rule.pages += 1;
      rules.set(violation.id, rule);
    }
    return { ...page, counts };
  });

  // Fix-first order: the most critical issues, then serious, and so on, then the total.
  pages.sort((a, b) => {
    for (const impact of IMPACTS) if (b.counts[impact] !== a.counts[impact]) return b.counts[impact] - a.counts[impact];
    return a.url.localeCompare(b.url);
  });

  const ruleList = [...rules.values()].sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || b.elements - a.elements || a.id.localeCompare(b.id),
  );

  const issues = IMPACTS.reduce((sum, impact) => sum + byImpact[impact], 0);
  const pagesWithIssues = pages.filter((page) => page.issueCount > 0).length;

  console.assert(issues === report.totals.issues, 'severity split must sum to the issue total', issues, report.totals.issues);
  console.assert(
    scanned.length + failed.length + skipped.length === report.totals.discoveredPages,
    'scanned + failed + skipped must equal pages found',
  );

  return {
    issues,
    byImpact,
    rules: ruleList,
    pages,
    failed,
    skipped,
    pagesWithIssues,
    counts: {
      found: report.totals.discoveredPages,
      scanned: scanned.length,
      failed: failed.length,
      skipped: skipped.length,
    },
    // The one finding: the most severe rule, and how far it reaches.
    topRule: ruleList[0] ?? null,
    checks: summarizeChecks(scanned),
  };
}