import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test('creating a public zone opens it with its name servers', async ({ page }) => {
  await signUp(page, uniqueEmail());

  await page.getByRole('link', { name: 'Create hosted zone' }).click();
  await expect(page).toHaveURL(/\/route53\/hosted-zones\/create$/);
  await page.getByLabel('Domain name').fill('Shop.Example.com.');
  await page.getByRole('textbox', { name: /Description/ }).fill('Storefront');
  await page.getByRole('button', { name: 'Create hosted zone' }).click();

  await expect(page).toHaveURL(/\/route53\/hosted-zones\/Z[A-Z0-9]{20}$/);
  await expect(
    page.getByText('shop.example.com was successfully created.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'shop.example.com', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/^ns-\d+\.awsdns-\d+\.com\.$/)).toBeVisible();

  await page.getByRole('link', { name: 'Hosted zones' }).first().click();
  await expect(page.getByRole('rowheader', { name: 'shop.example.com' })).toBeVisible();
  await expect(page.getByText('shop.example.com was successfully created.')).toBeHidden();
});

test('a private zone needs a VPC and shows it afterwards', async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.goto('/route53/hosted-zones/create');

  await page.getByLabel('Domain name').fill('internal.example.com');
  await page.getByRole('radio', { name: /Private hosted zone/ }).check();
  await page.getByRole('button', { name: 'Create hosted zone' }).click();
  await expect(page.getByText('Enter a VPC ID.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Region/ }).click();
  await page.getByRole('option', { name: /eu-west-1/ }).click();
  await page.getByLabel('VPC ID').fill('vpc-0a1b2c3d');
  await page.getByRole('button', { name: 'Create hosted zone' }).click();

  await expect(page).toHaveURL(/\/route53\/hosted-zones\/Z[A-Z0-9]{20}$/);
  await expect(page.getByText('Private hosted zone', { exact: true })).toBeVisible();
  await expect(
    page.getByText('vpc-0a1b2c3d (Europe (Ireland), eu-west-1)'),
  ).toBeVisible();
});

test('an unknown zone ID says so instead of crashing', async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.goto('/route53/hosted-zones/ZDOESNOTEXIST');

  await expect(
    page.getByText('No hosted zone found with ID ZDOESNOTEXIST.'),
  ).toBeVisible();
});

test('a zone description can be edited and an empty zone can be deleted', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  const created = await page.request.post('/api/v1/hosted-zones', {
    data: { name: 'lifecycle.example.com', comment: 'Old description' },
  });
  const zone = (await created.json()) as { id: string };
  await page.goto(`/route53/hosted-zones/${zone.id}`);

  await page.getByRole('button', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit hosted zone' });
  await editDialog.getByRole('textbox', { name: /Description/ }).fill('New description');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByText('lifecycle.example.com was successfully updated.'),
  ).toBeVisible();
  await expect(page.getByText('New description').first()).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete hosted zone' });
  await expect(
    deleteDialog.getByText('Deleting a hosted zone cannot be undone.'),
  ).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page).toHaveURL(/\/route53\/hosted-zones$/);
  await expect(
    page.getByText('lifecycle.example.com was successfully deleted.'),
  ).toBeVisible();
  await expect(
    page.getByRole('rowheader', { name: 'lifecycle.example.com' }),
  ).toHaveCount(0);
});

test('the hosted zones list searches and sorts on the server', async ({ page }) => {
  await signUp(page, uniqueEmail());
  for (const name of ['alpha.example.com', 'gamma.example.com', 'beta.example.com']) {
    const response = await page.request.post('/api/v1/hosted-zones', {
      data: { name },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.goto('/route53/hosted-zones');

  await page.getByRole('searchbox', { name: 'Find hosted zones' }).fill('beta');
  await expect(page.getByRole('rowheader', { name: 'beta.example.com' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'alpha.example.com' })).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Find hosted zones' }).fill('');
  await page.getByRole('button', { name: 'Hosted zone name' }).click();
  await expect(page.getByRole('rowheader')).toHaveText([
    'gamma.example.com',
    'beta.example.com',
    'alpha.example.com',
  ]);
});
