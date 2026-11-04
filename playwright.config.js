import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'msedge', headless: true },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'small-phone', use: { viewport: { width: 320, height: 740 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
