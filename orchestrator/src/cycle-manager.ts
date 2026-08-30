import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { StateMachine } from './state-machine.js';
import { inspectSite } from './browser/browser-manager.js';
import { mergeFindings, prioritize } from './reviewers/reviewer.js';
import { readFindings, saveFindings } from './memory/findings.js';
import { readTasks, saveTasks, taskFromFinding } from './memory/tasks.js';
import { saveCycle } from './memory/history.js';
import { implement, runChecks } from './agents/codex-agent.js';
import { saveScore, scoreSite } from './scoring/score-engine.js';
import { getBaseUrl, getConfig } from './config.js';
import { AntigravityAgent } from './agents/antigravity-agent.js';
const exec = promisify(execFile);

type Server = { child?: ReturnType<typeof import('node:child_process')['spawn']>; started: boolean };
async function git(args: string[]) { try { const { stdout } = await exec('git', args); return stdout.trim(); } catch { return ''; } }
async function ensureServer(baseUrl: string, serverConfig: { port: number; command: string }): Promise<Server> {
  try { const response = await fetch(baseUrl); if (response.ok) return { started: false }; } catch {}
  const { spawn } = await import('node:child_process');
  // Discovery does not need external services. Clearing the database URI keeps a
  // local review deterministic even when a developer's .env points to an
  // unavailable remote database.
  const [configuredCommand, ...configuredArgs] = serverConfig.command.trim().split(/\s+/);
  const child = spawn(configuredCommand === 'node' ? process.execPath : configuredCommand, configuredArgs, { env: { ...process.env, PORT: String(serverConfig.port), MONGODB_URI: '' }, stdio: 'pipe', windowsHide: true });
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try { if ((await fetch(baseUrl)).ok) return { child, started: true }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  child.kill(); throw new Error(`Server did not become available at ${baseUrl}.`);
}
function stopServer(server: Server) { if (server.started && server.child && !server.child.killed) server.child.kill(); }
async function smokeTest(baseUrl: string): Promise<{ ok: boolean; output: string }> {
  try { const { stdout, stderr } = await exec(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/smoke/homepage.spec.ts'], { env: { ...process.env, AGENT_BASE_URL: baseUrl } }); return { ok: true, output: `${stdout}${stderr}`.trim() }; }
  catch (error: any) { return { ok: false, output: `${error.stdout || ''}${error.stderr || error.message}`.trim() }; }
}
async function nextCycle() { const dirs = existsSync('.agent/cycles') ? await (await import('node:fs/promises')).readdir('.agent/cycles') : []; return dirs.filter(name => /^cycle-\d+$/.test(name)).length + 1; }

export async function review() {
  const config = await getConfig(); const baseUrl = getBaseUrl(config); const cycle = await nextCycle(); const server = await ensureServer(baseUrl, config.server);
  try { const browser = await inspectSite(baseUrl, cycle, 'before'); const antigravity = await new AntigravityAgent(config).reviewWebsite(baseUrl, browser); const findings = prioritize({ ...browser, findings: mergeFindings(browser.findings, antigravity.findings) }); await saveFindings(findings); return { cycle, browser, antigravity, findings }; }
  finally { stopServer(server); }
}
export async function verify() {
  const config = await getConfig(); const baseUrl = getBaseUrl(config); const cycle = await nextCycle(); const server = await ensureServer(baseUrl, config.server);
  try { const browser = await inspectSite(baseUrl, cycle, 'after'); const antigravity = await new AntigravityAgent(config).reviewWebsite(baseUrl, browser); const smoke = await smokeTest(baseUrl); const checks = await runChecks(); const score = scoreSite(browser, smoke.ok && checks.tests, checks.build); await saveScore(score); return { cycle, browser, antigravity, smoke, checks, score }; }
  finally { stopServer(server); }
}
export async function improve(): Promise<Record<string, unknown>> {
  const config = await getConfig(); const baseUrl = getBaseUrl(config);
  const machine = new StateMachine(); const cycle = await nextCycle(); let server: Server | undefined;
  if (cycle > config.maxCycles) throw new Error(`Maximum of ${config.maxCycles} cycles reached. Review .agent/cycles before starting a new run.`);
  try {
    machine.transition('START_CYCLE'); machine.transition('ENSURE_SERVER'); server = await ensureServer(baseUrl, config.server);
    machine.transition('DISCOVER'); machine.transition('PLAYWRIGHT_REVIEW'); const before = await inspectSite(baseUrl, cycle, 'before');
    machine.transition('ANTIGRAVITY_REVIEW'); const antigravityBefore = await new AntigravityAgent(config).reviewWebsite(baseUrl, before);
    machine.transition('ANALYZE'); machine.transition('CREATE_FINDINGS'); const findings = prioritize({ ...before, findings: mergeFindings(before.findings, antigravityBefore.findings) }); await saveFindings(findings);
    machine.transition('PRIORITIZE'); machine.transition('CREATE_TASK'); const tasks = findings.slice(0, config.maxTasksPerCycle).map((finding, index) => taskFromFinding(finding, index + 1)); await saveTasks(tasks);
    const previousScore = JSON.parse(await readFile('.agent/scores/latest.json', 'utf8')).score || 0;
    await saveCycle(cycle, 'before.sha', await git(['rev-parse', 'HEAD']));
    await saveCycle(cycle, 'before.diff', await git(['diff', '--binary']));
    machine.transition('CODEX_IMPLEMENT'); const changedFiles: string[] = []; const logs: string[] = [];
    for (const task of tasks) { task.status = 'working'; const result = await implement(task); logs.push(...result.logs); changedFiles.push(...result.changedFiles); task.status = result.success ? 'testing' : 'failed'; }
    await saveTasks(tasks);
    machine.transition('BUILD'); machine.transition('TEST'); const checks = await runChecks(); const smoke = await smokeTest(baseUrl);
    machine.transition('BROWSER_VERIFY'); const after = await inspectSite(baseUrl, cycle, 'after'); machine.transition('ANTIGRAVITY_VERIFY'); const antigravityAfter = await new AntigravityAgent(config).reviewWebsite(baseUrl, after);
    tasks.forEach(task => { if (task.status === 'testing' && checks.tests && smoke.ok && after.ok) task.status = 'verified'; }); await saveTasks(tasks);
    machine.transition('SCORE'); const score = scoreSite(after, checks.tests && smoke.ok, checks.build); await saveScore(score);
    machine.transition(score.approved ? 'PASS' : 'FAIL'); const report = { cycle, states: machine.history(), findings, antigravity_review: antigravityBefore, tasks, changed_files: changedFiles, implementation_logs: logs, test_results: { checks, smoke }, build_result: checks.build, browser_result: after, antigravity_verification: antigravityAfter, score, previous_score: previousScore, improvement: score.score - previousScore, remaining_problems: mergeFindings(after.findings, antigravityAfter.findings) };
    await saveCycle(cycle, 'after.sha', await git(['rev-parse', 'HEAD'])); await saveCycle(cycle, 'after.diff', await git(['diff', '--binary'])); await saveCycle(cycle, 'report.json', JSON.stringify(report, null, 2));
    // A failed cycle gets a fresh discovery pass and a new checkpoint; this
    // continues only within the configured finite budget.
    return !score.approved && cycle < config.maxCycles ? improve() : report;
  } finally { if (server) stopServer(server); }
}
export async function status() {
  const config = await getConfig(); const tasks = await readTasks(); const findings = await readFindings(); const score = JSON.parse(await readFile('.agent/scores/latest.json', 'utf8'));
  const { readdir } = await import('node:fs/promises');
  const entries = (await readdir('.agent/scores/history')).sort().reverse();
  const history = await Promise.all(entries.slice(0, 2).map(async entry => JSON.parse(await readFile(`.agent/scores/history/${entry}`, 'utf8'))));
  const previousScore = history.length > 1 ? history[1].score : null;
  return { current_cycle: (await nextCycle()) - 1, current_state: 'IDLE', current_task: tasks.find(task => task.status === 'working') || null, codex_status: tasks.some(task => task.status === 'working') ? 'working' : 'idle', playwright_status: 'ready', antigravity_status: config.antigravity.enabled ? 'configured' : 'manual_configuration_required', findings_count: findings.length, findings, tasks, current_score: score.score, previous_score: previousScore, improvement: previousScore === null ? null : score.score - previousScore, score, config };
}
