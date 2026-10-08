import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations,
    results.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help}\n${violation.nodes
            .map((node) => `  ${node.target.join(' ')}`)
            .join('\n')}`,
      )
      .join('\n'),
  ).toEqual([]);
}

test('the main hosted-zone workflows have no axe violations', async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expectNoAccessibilityViolations(page);

  await page.getByRole('link', { name: 'Create hosted zone' }).click();
  await expect(page.getByRole('heading', { name: 'Create hosted zone' })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  const response = await page.request.post('/api/v1/hosted-zones', {
    data: { name: 'accessible.example.com' },
  });
  expect(response.ok()).toBeTruthy();
  const zone = (await response.json()) as { id: string };
  await page.goto(`/route53/hosted-zones/${zone.id}`);
  await expect(
    page.getByRole('heading', { name: 'accessible.example.com' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test('the frontend sends baseline browser security headers', async ({ page }) => {
  const response = await page.goto('/signin');
  expect(response).not.toBeNull();

  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['permissions-policy']).toBe('camera=(), geolocation=(), microphone=()');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
});
