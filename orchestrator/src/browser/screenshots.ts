import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';

export async function capture(page: Page, stage: 'before' | 'after', cycle: number) {
  const dir = path.resolve('.agent/screenshots', stage);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `cycle-${String(cycle).padStart(3, '0')}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
