import type { BrowserResult } from '../browser/browser-manager.js';
import type { Finding } from '../memory/findings.js';
export function mergeFindings(...groups: Finding[][]): Finding[] {
  const seen = new Set<string>();
  return groups.flat().filter(finding => {
    const key = `${finding.category}|${finding.page}|${finding.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function prioritize(result: BrowserResult): Finding[] {
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return result.findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
