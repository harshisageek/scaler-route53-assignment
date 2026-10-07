import { expect, test } from '@playwright/test';

test('the console loads and reports a healthy backend', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Route 53', level: 1 })).toBeVisible();
  await expect(page.getByText('Backend connectivity')).toBeVisible();
  await expect(page.getByText('Environment')).toBeVisible();
});
