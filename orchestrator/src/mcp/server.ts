import readline from 'node:readline';
import { readFile } from 'node:fs/promises';
import { inspectSite } from '../browser/browser-manager.js';
import { getBaseUrl, getConfig } from '../config.js';
import { readFindings, saveFindings, type Finding } from '../memory/findings.js';
import { readTasks, saveTasks, type Task } from '../memory/tasks.js';
import { status } from '../cycle-manager.js';
import { runChecks } from '../agents/codex-agent.js';
import { saveScore, type Score } from '../scoring/score-engine.js';

type Rpc = { id?: string | number; method: string; params?: any };
const tools = [
  'project_get_state', 'project_get_spec', 'findings_list', 'findings_create', 'findings_update',
  'tasks_list', 'tasks_create', 'tasks_update', 'cycle_get_status', 'score_get', 'score_update',
  'browser_open', 'browser_snapshot', 'browser_screenshot', 'run_tests', 'run_build', 'get_current_url', 'save_review'
].map(name => ({ name, description: `Autonomous-development shared-memory tool: ${name}`, inputSchema: { type: 'object', properties: {} } }));

function reply(id: Rpc['id'], result: unknown) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
function failure(id: Rpc['id'], message: string) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } })}\n`); }
function content(value: unknown) { return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }; }
function nextId(prefix: string, items: { id: string }[]) { return `${prefix}-${String(items.length + 1).padStart(3, '0')}`; }

async function call(name: string, args: Record<string, unknown>) {
  if (name === 'project_get_state') return status();
  if (name === 'project_get_spec') return { project: await readFile('.agent/PROJECT.md', 'utf8'), productSpec: await readFile('.agent/PRODUCT_SPEC.md', 'utf8'), architecture: await readFile('.agent/ARCHITECTURE.md', 'utf8'), currentState: await readFile('.agent/CURRENT_STATE.md', 'utf8') };
  if (name === 'findings_list') return readFindings();
  if (name === 'findings_create') { const findings = await readFindings(); const finding = { ...(args as Partial<Finding>), id: String(args.id || nextId('F', findings)), status: args.status || 'open' } as Finding; await saveFindings([...findings, finding]); return finding; }
  if (name === 'findings_update') { const findings = await readFindings(); const id = String(args.id); const updated = findings.map(item => item.id === id ? { ...item, ...args, id } : item); await saveFindings(updated); return updated.find(item => item.id === id) || null; }
  if (name === 'tasks_list') return readTasks();
  if (name === 'tasks_create') { const tasks = await readTasks(); const task = { ...(args as Partial<Task>), id: String(args.id || nextId('TASK', tasks)), assigned_to: args.assigned_to || 'codex', status: args.status || 'queued', acceptance_criteria: args.acceptance_criteria || [] } as Task; await saveTasks([...tasks, task]); return task; }
  if (name === 'tasks_update') { const tasks = await readTasks(); const id = String(args.id); const updated = tasks.map(item => item.id === id ? { ...item, ...args, id } : item); await saveTasks(updated); return updated.find(item => item.id === id) || null; }
  if (name === 'cycle_get_status') return status();
  if (name === 'score_get') return JSON.parse(await readFile('.agent/scores/latest.json', 'utf8'));
  if (name === 'score_update') { const score = args as Score; await saveScore(score); return score; }
  if (name === 'get_current_url' || name === 'browser_open') { const config = await getConfig(); return { url: getBaseUrl(config) }; }
  if (name === 'browser_snapshot' || name === 'browser_screenshot') { const config = await getConfig(); const result = await inspectSite(getBaseUrl(config), Date.now(), name === 'browser_screenshot' ? 'after' : 'before'); return name === 'browser_screenshot' ? { screenshot: result.screenshot, url: result.url } : result; }
  if (name === 'run_tests') { const checks = await runChecks(); return { ok: checks.tests, ...checks }; }
  if (name === 'run_build') { const checks = await runChecks(); return { ok: checks.build, ...checks }; }
  if (name === 'save_review') { const findings = args.findings as Finding[]; if (!Array.isArray(findings)) throw new Error('findings must be an array.'); await saveFindings(findings); return { saved: findings.length }; }
  throw new Error(`Unknown tool: ${name}`);
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', async line => {
  try {
    const request = JSON.parse(line) as Rpc;
    if (request.method === 'initialize') return reply(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'autonomous-development-orchestrator', version: '2.0.0' } });
    if (request.method === 'tools/list') return reply(request.id, { tools });
    if (request.method === 'tools/call') return reply(request.id, content(await call(String(request.params?.name), request.params?.arguments || {})));
    if (request.method === 'notifications/initialized') return;
    failure(request.id, `Unsupported method: ${request.method}`);
  } catch (error: any) { failure(undefined, error.message || 'MCP server error'); }
});
