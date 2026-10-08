import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test('the console navigation, help panel and coming-soon pages work together', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());

  await expect(page.getByRole('link', { name: 'Hosted zones' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Help' }).click();
  await expect(
    page.getByRole('heading', { name: 'Hosted zones', exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Traffic policies' }).click();
  await expect(page).toHaveURL(/\/route53\/traffic-policies$/);
  await expect(
    page.getByRole('heading', { name: 'Traffic policies', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Breadcrumbs')).toContainText('Traffic policies');

  await page.goto('/route53/not-a-real-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('table preferences are saved for the signed-in account', async ({ page }) => {
  await signUp(page, uniqueEmail());

  await page.getByRole('button', { name: 'Preferences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Preferences' });
  await dialog.getByRole('radio', { name: '20 resources' }).check();
  await dialog.getByRole('button', { name: 'Confirm' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Preferences' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Preferences' }).getByRole('radio', {
      name: '20 resources',
    }),
  ).toBeChecked();
});
