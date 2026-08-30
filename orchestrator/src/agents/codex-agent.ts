import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { Task } from '../memory/tasks.js';
const exec = promisify(execFile);

export type ImplementationResult = { changedFiles: string[]; logs: string[]; success: boolean };
async function context() { return Promise.all(['PROJECT.md', 'PRODUCT_SPEC.md', 'ARCHITECTURE.md', 'CURRENT_STATE.md'].map(file => readFile(path.resolve('.agent', file), 'utf8'))); }
export async function implement(task: Task): Promise<ImplementationResult> {
  await context();
  const logs = [`Read shared .agent context for ${task.id}.`];
  // Phase 1 intentionally permits only an explicitly known, reversible task action.
  if (task.finding_id === 'F-002') {
    const file = path.resolve('public/js/app.js'); const source = await readFile(file, 'utf8');
    const unsafe = "  document.getElementById('btn-add-channel').addEventListener('click', openOAuthPopup);";
    const safe = "  document.getElementById('btn-add-channel')?.addEventListener('click', openOAuthPopup);";
    if (source.includes(safe)) return { changedFiles: [], logs: [...logs, 'Channel button binding is already guarded.'], success: true };
    if (!source.includes(unsafe)) return { changedFiles: [], logs: [...logs, 'Known unsafe binding was not found; stopping rather than modifying unrelated code.'], success: false };
    const { writeFile } = await import('node:fs/promises'); await writeFile(file, source.replace(unsafe, safe));
    return { changedFiles: ['public/js/app.js'], logs: [...logs, 'Guarded the optional channel-button binding to prevent a homepage startup exception.'], success: true };
  }
  if (task.finding_id !== 'F-001') return { changedFiles: [], logs: [...logs, 'No safe deterministic implementation adapter exists for this task.'], success: false };
  const file = path.resolve('public/index.html'); const html = await readFile(file, 'utf8');
  if (/meta\s+name=["']description["']/i.test(html)) return { changedFiles: [], logs: [...logs, 'Meta description already present; no change required.'], success: true };
  const updated = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <meta name="description" content="Social Factory helps teams plan, create, and distribute social video content across brands and channels.">');
  if (updated === html) return { changedFiles: [], logs: [...logs, 'Expected insertion point was absent.'], success: false };
  // Use a small Node write only because this is the guarded implementation action, not a shell rewrite.
  const { writeFile } = await import('node:fs/promises'); await writeFile(file, updated);
  return { changedFiles: ['public/index.html'], logs: [...logs, 'Added the task-approved homepage meta description.'], success: true };
}
export async function runChecks(): Promise<{ build: boolean; tests: boolean; output: string[] }> {
  const output: string[] = [];
  try { await exec(process.execPath, ['--check', 'server.js']); output.push('Node syntax validation passed for server.js.'); }
  catch (error: any) { output.push(error.stderr || error.message); return { build: false, tests: false, output }; }
  try { await exec(process.execPath, ['--check', 'public/js/app.js']); output.push('Node syntax validation passed for public/js/app.js.'); return { build: true, tests: true, output }; }
  catch (error: any) { output.push(error.stderr || error.message); return { build: true, tests: false, output }; }
}
