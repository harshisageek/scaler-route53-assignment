import { expect, test } from '@playwright/test';

test('the console opens on the hosted zones list, filled from the API', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/route53\/hosted-zones$/);
  await expect(
    page.getByRole('heading', { name: /Hosted zones/, level: 1 }),
  ).toBeVisible();
  // Seeded by the backend on first start.
  await expect(page.getByRole('rowheader', { name: 'example.com' })).toBeVisible();
});
