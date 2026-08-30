import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserResult } from '../browser/browser-manager.js';
export type Score = { score: number; threshold: number; approved: boolean; dimensions: Record<string, number> };
export function scoreSite(browser: BrowserResult, testsPassing: boolean, buildPassing: boolean): Score {
  const dimensions = { UI: 10, UX: browser.findings.some(f => f.category === 'UX') ? 8 : 15, PRODUCT_LOGIC: browser.ok ? 25 : 10, ARCHITECTURE: 15, PERFORMANCE: 5, AUTOMATION: testsPassing && buildPassing && browser.ok ? 30 : 10 };
  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  return { score, threshold: 85, approved: score >= 85 && testsPassing && buildPassing && browser.ok, dimensions };
}
export async function saveScore(score: Score) {
  const root = path.resolve('.agent/scores'); await mkdir(path.join(root, 'history'), { recursive: true });
  const body = JSON.stringify({ ...score, updatedAt: new Date().toISOString() }, null, 2);
  await writeFile(path.join(root, 'latest.json'), body); await writeFile(path.join(root, 'history', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`), body);
}
