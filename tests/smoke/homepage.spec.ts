import { expect, test } from '@playwright/test';

test('homepage renders without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) errors.push(message.text());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
