import { test, expect } from '@playwright/test';

const noOverflow = async page => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};

test('login and company registration fit the viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.login-card')).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Register LPG Company' }).click();
  await expect(page.locator('.reg-grid').first()).toBeVisible();
  await noOverflow(page);
});

test('navigation retains module access and closes with Escape or selection', async ({ page }, testInfo) => {
  const modules = ['dashboard', 'inventory', 'products', 'pos'];
  await page.addInitScript(() => localStorage.setItem('token', 'ui-test-only'));
  await page.route('http://localhost:4000/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/auth/me'
      ? { UserID: 'test', FirstName: 'Mobile', LastName: 'Tester', RoleName: 'Administrator', ModuleAccess: modules }
      : path === '/dashboard/summary'
        ? { salesPerformance: 0, salesPerformanceChangeLabel: '0%', transactions: 0, transactionsChangeLabel: '0%', stockAttention: 0, bestSeller: 'None', salesTrend: [], restockSuggestions: [], activityLog: [] }
        : [] });
  });
  await page.goto('/');
  const nav = page.locator('.sidebar-nav');
  await expect(nav.locator('button')).toHaveCount(4);
  if (testInfo.project.name === 'desktop') {
    await expect(nav).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
  } else {
    await expect(nav).toBeHidden();
    const open = page.getByRole('button', { name: 'Open navigation' });
    await open.click();
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await nav.getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(nav).toBeHidden();
    await expect(page.locator('.mobile-header')).toContainText('Inventory');
  }
  await noOverflow(page);
});
