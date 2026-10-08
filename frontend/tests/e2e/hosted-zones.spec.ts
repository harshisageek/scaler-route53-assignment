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
