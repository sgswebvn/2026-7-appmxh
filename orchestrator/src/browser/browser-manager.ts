import { chromium } from '@playwright/test';
import type { Finding } from '../memory/findings.js';
import { capture } from './screenshots.js';

export type BrowserResult = { ok: boolean; url: string; title: string; consoleErrors: string[]; checked: string[]; screenshot?: string; findings: Finding[] };
export type BrowserAction = { type: 'click'; selector: string } | { type: 'fill'; selector: string; value: string } | { type: 'expect'; selector: string };

/** Reusable real-browser actions for future smoke and e2e discovery scenarios. */
export async function performActions(page: import('@playwright/test').Page, actions: BrowserAction[]) {
  for (const action of actions) {
    if (action.type === 'click') await page.locator(action.selector).click();
    if (action.type === 'fill') await page.locator(action.selector).fill(action.value);
    if (action.type === 'expect') {
      if (await page.locator(action.selector).count() === 0) throw new Error(`Required element was not found: ${action.selector}`);
    }
  }
}

export async function inspectSite(baseUrl: string, cycle: number, stage: 'before' | 'after'): Promise<BrowserResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    // The desktop sandbox denies third-party font requests. Keep that environmental
    // limitation out of the application-error gate while retaining real JS errors.
    if (msg.type() === 'error' && !msg.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));
  try {
    const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    const title = await page.title();
    const bodyPresent = await page.locator('body').count() > 0;
    const hasViewport = await page.locator('meta[name="viewport"]').count() > 0;
    const hasDescription = await page.locator('meta[name="description"]').count() > 0;
    const screenshot = await capture(page, stage, cycle);
    const findings: Finding[] = [];
    if (!hasDescription) findings.push({ id: 'F-001', severity: 'P2', category: 'UX', page: '/', title: 'Homepage lacks a meta description', problem: 'The rendered homepage has no meta description, which weakens link previews and search-result context.', evidence: ['Playwright: meta[name="description"] was not found on /.'], expected: 'The homepage provides a concise meta description.', recommendation: 'Add a task-scoped meta description to public/index.html.', status: 'open' });
    if (consoleErrors.length) findings.push({ id: 'F-002', severity: 'P1', category: 'BUG', page: '/', title: 'Browser console errors detected', problem: 'The live homepage emitted browser errors.', evidence: consoleErrors, expected: 'Homepage loads without console errors.', recommendation: 'Investigate the affected client-side dependency before changing unrelated code.', status: 'open' });
    return { ok: Boolean(response?.ok()) && bodyPresent && consoleErrors.length === 0, url: baseUrl, title, consoleErrors, checked: ['HTTP response', 'body rendered', 'viewport meta tag', 'console errors'], screenshot, findings };
  } finally { await browser.close(); }
}
