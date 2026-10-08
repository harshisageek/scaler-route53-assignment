import { expect, test } from '@playwright/test';

test('a visitor is asked to sign in, then the demo opens on the hosted zones list', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/signin$/);
  await page.getByRole('button', { name: 'Try the demo' }).click();

  await expect(page).toHaveURL(/\/route53\/hosted-zones$/);
  await expect(
    page.getByRole('heading', { name: /Hosted zones/, level: 1 }),
  ).toBeVisible();
  // Sample data the backend creates for the demo account.
  await expect(
    page.getByRole('rowheader', { name: 'example.com', exact: true }),
  ).toBeVisible();
});
