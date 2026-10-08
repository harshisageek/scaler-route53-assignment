import { expect, test } from '@playwright/test';
import { PASSWORD, signUp, uniqueEmail } from './helpers';

test('a new account starts empty and cannot see the demo zones', async ({ page }) => {
  await signUp(page, uniqueEmail());

  await expect(page.getByText('No hosted zones')).toBeVisible();
  await expect(page.getByRole('rowheader')).toHaveCount(0);
});

test('signing out ends the session and protects the console', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);

  await page.getByRole('button', { name: email }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin$/);

  await page.goto('/route53/hosted-zones');
  await expect(page).toHaveURL(/\/signin$/);
});

test('a wrong password is refused and the right one gets in', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await page.context().clearCookies();

  await page.goto('/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('not my password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByText('Incorrect email or password.', { exact: true }),
  ).toBeVisible();

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/route53\/hosted-zones$/);
});

test('a deep link survives the trip through sign-in', async ({ page }) => {
  await page.goto('/route53/hosted-zones?view=all');

  await expect(page).toHaveURL(/\/signin\?next=%2Froute53%2Fhosted-zones%3Fview%3Dall$/);
  await page.getByRole('button', { name: 'Try the demo' }).click();

  await expect(page).toHaveURL(/\/route53\/hosted-zones\?view=all$/);
});
