import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test('a record can be created, edited, found and deleted', async ({ page }) => {
  await signUp(page, uniqueEmail());
  const created = await page.request.post('/api/v1/hosted-zones', {
    data: { name: 'records.example.com' },
  });
  const zone = (await created.json()) as { id: string };
  await page.goto(`/route53/hosted-zones/${zone.id}`);

  await expect(
    page.getByRole('row', { name: /records\.example\.com.*NS/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('row', { name: /records\.example\.com.*SOA/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create record' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Create record' });
  await createDialog.getByLabel('Record name').fill('www');
  await createDialog.getByRole('textbox', { name: 'Value' }).fill('192.0.2.10');
  await createDialog.getByLabel('TTL (seconds)').fill('60');
  await createDialog.getByRole('button', { name: 'Create record' }).click();

  await expect(
    page.getByText('www.records.example.com. was successfully created.'),
  ).toBeVisible();
  let row = page.getByRole('row', { name: /www\.records\.example\.com.*192\.0\.2\.10/ });
  await expect(row).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();

  const filter = page.getByRole('combobox', { name: 'Filter records' });
  await filter.fill('www');
  await page.getByRole('option', { name: 'Use: www' }).click();
  await expect(row).toBeVisible();
  await expect(page.getByRole('row', { name: /records\.example\.com.*SOA/ })).toHaveCount(
    0,
  );
  await page.reload();

  row = page.getByRole('row', { name: /www\.records\.example\.com.*192\.0\.2\.10/ });
  await row.getByRole('radio').check();
  await page.getByRole('button', { name: 'Edit' }).last().click();
  const editDialog = page.getByRole('dialog', { name: 'Edit record' });
  await editDialog.getByRole('textbox', { name: 'Value' }).fill('192.0.2.20');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByText('www.records.example.com. was successfully updated.'),
  ).toBeVisible();
  await expect(page.getByText('192.0.2.20')).toBeVisible();

  row = page.getByRole('row', { name: /www\.records\.example\.com.*192\.0\.2\.20/ });
  await row.getByRole('radio').check();
  await page.getByRole('button', { name: 'Delete' }).last().click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete record' });
  await deleteDialog.getByRole('button', { name: 'Delete' }).click();

  await expect(
    page.getByText('www.records.example.com. A was successfully deleted.'),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: /www\.records\.example\.com/ })).toHaveCount(
    0,
  );
});
