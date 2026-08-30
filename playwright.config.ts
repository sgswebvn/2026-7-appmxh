import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { baseURL: process.env.AGENT_BASE_URL || 'http://127.0.0.1:3000', headless: true }
});
