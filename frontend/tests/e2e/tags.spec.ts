import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test('hosted zone tags can be created, edited and filtered', async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.getByRole('link', { name: 'Create hosted zone' }).click();

  await page.getByLabel('Domain name').fill('tagged.example.com');
  await page.getByRole('button', { name: 'Add new tag' }).click();
  await page.getByPlaceholder('Enter key').fill('Environment');
  await page.getByPlaceholder('Enter value').fill('Production');
  await page.getByRole('button', { name: 'Create hosted zone' }).click();

  await expect(page.getByRole('rowheader', { name: 'Environment' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Production' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).first().click();
  const editDialog = page.getByRole('dialog', { name: 'Edit hosted zone' });
  await editDialog.getByPlaceholder('Enter value').fill('Staging');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('cell', { name: 'Staging' })).toBeVisible();

  await page.getByRole('link', { name: 'Hosted zones' }).first().click();
  const filter = page.getByRole('combobox', { name: 'Find hosted zones' });
  await filter.click();
  await page.getByRole('option', { name: 'Tag key' }).click();
  await filter.fill('Tag key = Environment');
  await page.getByRole('option', { name: 'Use: Tag key = Environment' }).click();

  await expect(page.getByRole('rowheader', { name: 'tagged.example.com' })).toBeVisible();
});
