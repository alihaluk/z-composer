import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { acceptConfirm, catalogAction, elementsOn, field, loadPreset, open, propertiesPanel, tool, toolsPanel } from './helpers';

const catalogPanel = (page: Page) => toolsPanel(page).locator('section').filter({ has: page.getByRole('heading', { name: 'Field Catalog' }) });
const editor = (page: Page) => page.getByRole('dialog', { name: 'Field Catalog' });

async function chooseFile(page: Page, button: string, data: unknown) {
  const chooser = page.waitForEvent('filechooser');
  await (await catalogAction(page, button)).click();
  await (await chooser).setFiles({ name: 'orders.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

test.describe('field catalog', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('the editor adds a field and its sample value reaches the canvas', async ({ page }) => {
    await catalogPanel(page).getByRole('button', { name: 'Edit' }).click();
    await expect(editor(page)).toBeVisible();
    // The last "add" row is the top level; the ones before belong to the arrays.
    await editor(page).getByLabel('New field path (e.g. Customer.Phone)').last().fill('Customer.Phone');
    await editor(page).getByRole('button', { name: 'Add field' }).last().click();
    const sample = editor(page).getByLabel('Sample data');
    const data = JSON.parse(await sample.inputValue());
    data.Customer.Phone = '0312 111 22 33';
    await sample.fill(JSON.stringify(data));
    await editor(page).getByRole('button', { name: 'Apply' }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(catalogPanel(page)).toContainText('38 fields');

    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await propertiesPanel(page).getByRole('radio', { name: 'Field', exact: true }).click();
    await field(page, 'Field').first().selectOption('Customer.Phone');
    await expect(elementsOn(page, 'Header').first()).toContainText('0312 111 22 33');
  });

  test('invalid sample JSON is reported and Escape cancels', async ({ page }) => {
    await catalogPanel(page).getByRole('button', { name: 'Edit' }).click();
    await editor(page).getByLabel('Sample data').fill('{ not json');
    await editor(page).getByRole('button', { name: 'Apply' }).click();
    await expect(editor(page).getByRole('alert')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toHaveCount(0);
    await expect(catalogPanel(page)).toContainText('37 fields');
  });

  test('a catalog is built from sample JSON and missing fields are flagged', async ({ page }) => {
    await loadPreset(page);
    await chooseFile(page, 'From sample JSON', { Order: { No: 'S-1', Total: 12.5 }, Items: [{ Name: 'Çay', Qty: 2 }] });
    await expect(catalogPanel(page).getByRole('status').last()).toContainText('Catalog loaded: 5 fields');
    await expect(catalogPanel(page)).toContainText('orders');
    // The preset uses fields this catalog does not have.
    await expect(catalogPanel(page).getByRole('status').first()).toContainText('fields that are not in the catalog');

    acceptConfirm(page, /default catalog/);
    await (await catalogAction(page, 'Default catalog')).click();
    await expect(catalogPanel(page)).toContainText('37 fields');
    await expect(catalogPanel(page).getByText('fields that are not in the catalog')).toHaveCount(0);
  });

  test('a catalog is built from a JSON Schema', async ({ page }) => {
    await chooseFile(page, 'From JSON Schema', {
      type: 'object',
      properties: {
        Ticket: { type: 'object', properties: { Id: { type: 'string' }, At: { type: 'string', format: 'date-time' }, Paid: { type: 'boolean' } } },
      },
    });
    await expect(catalogPanel(page).getByRole('status').last()).toContainText('Catalog loaded: 3 fields');
    await expect(catalogPanel(page)).toContainText('3 fields');
  });

  test('the catalog is saved as a file', async ({ page }) => {
    await page.addInitScript(() => { delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
    await page.reload();
    const download = page.waitForEvent('download');
    await (await catalogAction(page, 'Save catalog')).click();
    const file = await download;
    const saved = JSON.parse(readFileSync((await file.path())!, 'utf8'));
    expect(saved.fields.some((f: { path: string }) => f.path === 'Document.QrContent')).toBe(true);
    expect(saved.sample.Document.Number).toBe('FTR2026000000123');
  });
});
