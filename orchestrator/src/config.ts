import { readFile } from 'node:fs/promises';

export type AgentConfig = {
  maxCycles: number; maxTasksPerCycle: number; qualityThreshold: number;
  requireTestsPassing: boolean; requireBrowserVerification: boolean;
  server: { host: string; port: number; baseUrl: string; command: string };
  antigravity: { enabled: boolean; command: string | null; reviewTimeoutMs: number };
};

export async function getConfig(): Promise<AgentConfig> {
  return JSON.parse(await readFile('.agent/config.json', 'utf8')) as AgentConfig;
}

export function getBaseUrl(config: AgentConfig) { return process.env.AGENT_BASE_URL || config.server.baseUrl; }
