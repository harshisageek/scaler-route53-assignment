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

test('default records are protected and CNAME mistakes stay in the form', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  const created = await page.request.post('/api/v1/hosted-zones', {
    data: { name: 'protected.example.com' },
  });
  const zone = (await created.json()) as { id: string };
  const recordsResponse = await page.request.get(
    `/api/v1/hosted-zones/${zone.id}/records`,
  );
  const records = (await recordsResponse.json()) as {
    items: { id: number; type: string }[];
  };
  const ns = records.items.find((record) => record.type === 'NS');
  expect(ns).toBeTruthy();

  const attemptedDelete = await page.request.delete(
    `/api/v1/hosted-zones/${zone.id}/records/${ns!.id}`,
  );
  expect(attemptedDelete.status()).toBe(409);
  expect((await attemptedDelete.json()).error.code).toBe('ProtectedRecordSet');

  await page.goto(`/route53/hosted-zones/${zone.id}`);
  const nsRow = page.getByRole('row', { name: /protected\.example\.com.*NS/ });
  await nsRow.getByRole('radio').check();
  await expect(page.getByRole('button', { name: 'Edit' }).last()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete' }).last()).toBeDisabled();

  await page.getByRole('button', { name: 'Create record' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create record' });
  await dialog.getByRole('button', { name: /Record type/ }).click();
  await page.getByRole('option', { name: /CNAME/ }).click();
  await dialog
    .getByRole('textbox', { name: 'Value' })
    .fill('one.example.com\ntwo.example.com');
  await dialog.getByRole('button', { name: 'Create record' }).click();

  await expect(
    dialog.getByText('A CNAME record cannot be created at the zone apex.'),
  ).toBeVisible();
  await expect(
    dialog.getByText('A CNAME record must have exactly one value.'),
  ).toBeVisible();
});

test('weighted and failover routing policies are stored and displayed', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  const created = await page.request.post('/api/v1/hosted-zones', {
    data: { name: 'routing.example.com' },
  });
  const zone = (await created.json()) as { id: string };
  await page.goto(`/route53/hosted-zones/${zone.id}`);

  await page.getByRole('button', { name: 'Create record' }).click();
  let dialog = page.getByRole('dialog', { name: 'Create record' });
  await dialog.getByLabel('Record name').fill('api');
  await dialog.getByRole('textbox', { name: 'Value' }).fill('192.0.2.10');
  await dialog.getByRole('button', { name: /Simple routing/ }).click();
  await page.getByRole('option', { name: /Weighted/ }).click();
  await dialog.getByLabel('Set identifier').fill('blue');
  await dialog.getByRole('spinbutton', { name: 'Weight' }).fill('25');
  await dialog.getByRole('button', { name: 'Create record' }).click();

  await expect(
    page.getByRole('row', { name: /api\.routing\.example\.com.*Weighted \(25\).*blue/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create record' }).click();
  dialog = page.getByRole('dialog', { name: 'Create record' });
  await dialog.getByLabel('Record name').fill('failover');
  await dialog.getByRole('textbox', { name: 'Value' }).fill('192.0.2.20');
  await dialog.getByRole('button', { name: /Simple routing/ }).click();
  await page.getByRole('option', { name: /Failover/ }).click();
  await dialog.getByLabel('Set identifier').fill('primary');
  await dialog.getByRole('button', { name: /Choose a failover role/ }).click();
  await page.getByRole('option', { name: 'Primary' }).click();
  await dialog.getByRole('button', { name: 'Create record' }).click();

  await expect(
    page.getByRole('row', {
      name: /failover\.routing\.example\.com.*Failover \(primary\).*primary/,
    }),
  ).toBeVisible();
});
