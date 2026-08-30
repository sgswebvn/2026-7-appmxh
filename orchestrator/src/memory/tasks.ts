import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Finding } from './findings.js';

export type Task = { id: string; finding_id: string; priority: 'P0'|'P1'|'P2'|'P3'; title: string; description: string; acceptance_criteria: string[]; assigned_to: 'antigravity'|'native-orchestrator'|string; status: 'queued'|'working'|'testing'|'verified'|'failed' };
const root = path.resolve('.agent/tasks');
export async function readTasks(): Promise<Task[]> { try { return JSON.parse(await readFile(path.join(root, 'active.json'), 'utf8')); } catch { return []; } }
export function taskFromFinding(finding: Finding, index: number): Task {
  return { id: `TASK-${String(index).padStart(3, '0')}`, finding_id: finding.id, priority: finding.severity, title: finding.title, description: `${finding.problem}\n\nRecommendation: ${finding.recommendation}`, acceptance_criteria: [finding.expected, 'The affected page loads without browser console errors.'], assigned_to: 'antigravity', status: 'queued' };
}
export async function saveTasks(tasks: Task[]) {
  await mkdir(path.join(root, 'history'), { recursive: true }); const body = JSON.stringify(tasks, null, 2);
  await writeFile(path.join(root, 'active.json'), body); await writeFile(path.join(root, 'history', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`), body);
}
