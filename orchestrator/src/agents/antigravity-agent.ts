import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentConfig } from '../config.js';
import type { BrowserResult } from '../browser/browser-manager.js';
import type { Finding } from '../memory/findings.js';
const exec = promisify(execFile);

export type AntigravityReview = {
  available: boolean; provider: 'antigravity'; status: 'completed' | 'unavailable' | 'failed';
  findings: Finding[]; evidence: string[]; message: string;
};

function validFinding(value: unknown): value is Finding {
  const item = value as Partial<Finding>;
  return Boolean(item && item.severity && item.category && item.page && item.title && item.problem && Array.isArray(item.evidence) && item.expected && item.recommendation);
}

export class AntigravityAgent {
  constructor(private readonly config: AgentConfig) {}

  async captureEvidence(browser: BrowserResult) { return browser.screenshot ? [browser.screenshot, browser.url] : [browser.url]; }
  async analyzeUX(browser: BrowserResult) { return this.reviewWebsite(browser.url, browser); }
  async analyzeVisual(browser: BrowserResult) { return this.reviewWebsite(browser.url, browser); }
  async analyzeProductFlow(browser: BrowserResult) { return this.reviewWebsite(browser.url, browser); }
  async returnFindings(browser: BrowserResult) { return this.reviewWebsite(browser.url, browser); }

  async reviewWebsite(baseUrl: string, browser: BrowserResult): Promise<AntigravityReview> {
    const evidence = await this.captureEvidence(browser);
    if (!this.config.antigravity.enabled || !this.config.antigravity.command) {
      return { available: false, provider: 'antigravity', status: 'unavailable', findings: [], evidence, message: 'Antigravity is not configured. See .agents/ANTIGRAVITY_SETUP.md.' };
    }
    try {
      const { stdout } = await exec(this.config.antigravity.command, [baseUrl], { timeout: this.config.antigravity.reviewTimeoutMs, windowsHide: true, maxBuffer: 1_000_000 });
      const parsed = JSON.parse(stdout) as unknown;
      if (!Array.isArray(parsed) || !parsed.every(validFinding)) throw new Error('Antigravity output must be a JSON array using the shared Finding format.');
      return { available: true, provider: 'antigravity', status: 'completed', findings: parsed.map((finding, index) => ({ ...finding, id: finding.id || `AG-${String(index + 1).padStart(3, '0')}`, status: 'open' })), evidence, message: 'Antigravity review completed.' };
    } catch (error: any) {
      return { available: true, provider: 'antigravity', status: 'failed', findings: [], evidence, message: error.message || 'Antigravity review failed.' };
    }
  }
}
