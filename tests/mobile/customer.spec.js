import { test, expect } from '@playwright/test';

const customer = { customerId: 'CUST-002', fullName: 'Test Customer', email: 'customer@example.test' };
async function mockAuth(page) {
  await page.route('http://localhost:4000/customer-auth/**', route => route.fulfill({ json:
    route.request().method() === 'GET' ? customer : { token: 'customer-test-token', customer } }));
}

test('customer login opens the AR guide and keeps staff credentials separate', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/#/customer');
  await page.locator('input[name=email]').fill(customer.email);
  await page.locator('input[name=password]').fill('Customer123!');
  await page.getByRole('button', { name: 'Sign in as customer' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Test Customer' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.getByRole('button', { name: 'Open AR visual guide' }).click();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await page.getByRole('radio', { name: /50kg Commercial/ }).click();
  await expect(page.getByRole('radio', { name: /50kg Commercial/ })).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('camera denial offers retry and back navigation', async ({ page }) => {
  await mockAuth(page);
  await page.addInitScript(() => {
    localStorage.setItem('gastrack.customer.token', 'customer-test-token');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    } });
  });
  await page.goto('/#/customer');
  await page.getByRole('button', { name: 'Open AR visual guide' }).click();
  await page.getByRole('button', { name: 'Start camera guide' }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission was denied');
  await expect(page.getByRole('button', { name: 'Retry camera' })).toBeVisible();
  await page.getByRole('button', { name: 'Close camera' }).click();
  await expect(page.getByRole('heading', { name: 'Your cylinder, in view' })).toBeVisible();
});

test('selected tank is used in the camera overlay and tracks stop on exit', async ({ page }) => {
  await mockAuth(page);
  await page.addInitScript(() => {
    localStorage.setItem('gastrack.customer.token', 'customer-test-token');
    window.cameraStops = 0;
    HTMLVideoElement.prototype.play = async () => {};
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      const canvas = document.createElement('canvas');
      const media = canvas.captureStream();
      for (const track of media.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { window.cameraStops++; stop(); };
      }
      return media;
    } } });
  });
  await page.goto('/#/customer');
  await page.getByRole('button', { name: 'Open AR visual guide' }).click();
  await page.getByRole('radio', { name: /2.7kg Camping/ }).click();
  await page.getByRole('button', { name: 'Start camera guide' }).click();
  await expect(page.getByAltText('2.7kg Camping reference overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Hide reference' }).click();
  await expect(page.getByAltText('2.7kg Camping reference overlay')).toBeHidden();
  await page.getByRole('button', { name: 'Close camera' }).click();
  expect(await page.evaluate(() => window.cameraStops)).toBeGreaterThan(0);
});
