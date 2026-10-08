import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test('the console navigation, help panel and unimplemented pages work together', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());

  await expect(page.getByRole('link', { name: 'Hosted zones' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Hosted zones', exact: true, level: 2 }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Traffic policies' }).click();
  await expect(page).toHaveURL(/\/route53\/traffic-policies$/);
  await expect(
    page.getByRole('heading', { name: 'Traffic policies', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Not implemented', { exact: true })).toBeVisible();
  await expect(page.getByText(/outside the scope of this clone/)).toBeVisible();
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

test('keyboard shortcuts navigate, focus search, and stay inactive while typing', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());

  await page.keyboard.type('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();

  await page.keyboard.press('c');
  await expect(page).toHaveURL(/\/route53\/hosted-zones\/create$/);
  await page.getByRole('heading', { name: 'Create hosted zone' }).click();
  await page.keyboard.press('g');
  await page.keyboard.press('z');
  await expect(page).toHaveURL(/\/route53\/hosted-zones$/);

  const search = page.getByRole('combobox', { name: 'Find hosted zones' });
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await search.fill('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
});

test('dark mode is remembered across reloads', async ({ page }) => {
  await signUp(page, uniqueEmail());

  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('route53-color-mode')))
    .toBe('dark');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible();
});
