import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type Finding = {
  id: string; severity: 'P0' | 'P1' | 'P2' | 'P3';
  category: 'UI' | 'UX' | 'LOGIC' | 'BUG' | 'PERFORMANCE' | 'ARCHITECTURE';
  page: string; title: string; problem: string; evidence: string[];
  expected: string; recommendation: string; status: 'open' | 'in_progress' | 'fixed' | 'verified';
};

const root = path.resolve('.agent/findings');
export async function readFindings(): Promise<Finding[]> {
  try { return JSON.parse(await readFile(path.join(root, 'latest.json'), 'utf8')); } catch { return []; }
}
export async function saveFindings(findings: Finding[]) {
  await mkdir(path.join(root, 'history'), { recursive: true });
  const body = JSON.stringify(findings, null, 2);
  await writeFile(path.join(root, 'latest.json'), body);
  await writeFile(path.join(root, 'history', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`), body);
}
