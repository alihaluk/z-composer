import { expect, test, type Page } from '@playwright/test';
import { acceptConfirm, band, deselect, elementsOn, field, fill, loadPreset, open, propertiesPanel, toolsPanel } from './helpers';

const picker = (page: Page) => page.getByRole('dialog', { name: 'Ready-made templates' });
const catalogName = (page: Page) => toolsPanel(page).locator('section').filter({ has: page.getByRole('heading', { name: 'Field Catalog' }) }).locator('p').first();

const PRESETS = [
  { name: 'e-Fatura', bands: ['Header', 'Lines', 'VAT title', 'VAT lines', 'Totals', 'Footer'], catalog: 'Genel fatura', text: '2.845,52' },
  { name: 'e-Arşiv invoice', bands: ['Header', 'Lines', 'Totals', 'Footer'], catalog: 'e-Arşiv fatura', text: '894,48' },
  { name: 'Despatch advice (e-İrsaliye)', bands: ['Header', 'Lines', 'Signatures'], catalog: 'Sevk irsaliyesi', text: '34 ABC 123' },
  { name: 'Collection receipt', bands: ['Header', 'Payments', 'Totals', 'Signatures'], catalog: 'Tahsilat makbuzu', text: '5.250,00' },
  { name: 'Restaurant bill (e-Adisyon)', bands: ['Header', 'Lines', 'Discount', 'Totals', 'Footer'], catalog: 'Adisyon', text: 'Bahçe 12' },
];

test.describe('ready-made templates', () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await fill(field(page, 'Preview culture'), 'tr-TR');
  });

  test('the picker lists every template and closes with Escape', async ({ page }) => {
    await toolsPanel(page).getByRole('button', { name: 'Ready-made templates…' }).click();
    await expect(picker(page).getByRole('listitem')).toHaveCount(5);
    await expect(picker(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(picker(page)).toHaveCount(0);
    await expect(band(page, 'Header')).toBeVisible();
    await expect(page.getByText('Start designing')).toBeVisible();
  });

  for (const preset of PRESETS) {
    test(`${preset.name} loads with its catalog, passes the check and previews`, async ({ page }) => {
      await loadPreset(page, preset.name);
      for (const name of preset.bands) await expect(band(page, name)).toBeVisible();
      await expect(catalogName(page)).toHaveText(preset.catalog);
      await expect(page.locator('main')).toContainText(preset.text);
      await deselect(page);
      await expect(propertiesPanel(page).getByText('No problems found')).toBeVisible();

      await page.getByRole('button', { name: 'Preview ZPL' }).click();
      const dialog = page.getByRole('dialog', { name: 'ZPL Preview' });
      await expect(dialog.getByLabel('Print preview')).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByText('Failed to render preview')).toHaveCount(0);
    });
  }

  test('switching between templates switches catalogs without asking', async ({ page }) => {
    page.on('dialog', d => { throw new Error(`Unexpected dialog: ${d.message()}`); });
    await loadPreset(page, 'Collection receipt');
    await loadPreset(page, 'Restaurant bill (e-Adisyon)');
    await expect(catalogName(page)).toHaveText('Adisyon');
    await loadPreset(page, 'e-Fatura');
    await expect(catalogName(page)).toHaveText('Genel fatura');
  });

  test('the user\'s own catalog is replaced only when they agree', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser');
    await toolsPanel(page).getByRole('button', { name: 'From sample JSON' }).click();
    await (await chooser).setFiles({ name: 'mine.json', mimeType: 'application/json', buffer: Buffer.from('{"Order":{"No":"1"}}') });
    await expect(catalogName(page)).toHaveText('mine');

    // Cancel: the template loads, the catalog stays, the check reports the missing fields.
    page.once('dialog', d => { expect(d.message()).toContain('"Sevk irsaliyesi"'); expect(d.message()).toContain('"mine"'); void d.dismiss(); });
    await loadPreset(page, 'Despatch advice (e-İrsaliye)');
    await expect(band(page, 'Signatures')).toBeVisible();
    await expect(catalogName(page)).toHaveText('mine');
    await expect(page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: /^Design check: / })).toBeVisible();

    acceptConfirm(page, /"Sevk irsaliyesi"/);
    await loadPreset(page, 'Despatch advice (e-İrsaliye)');
    await expect(catalogName(page)).toHaveText('Sevk irsaliyesi');
  });

  test('loading a template is undone with Ctrl or Cmd + Z', async ({ page }) => {
    await toolsPanel(page).getByRole('button', { name: 'Text', exact: true }).click();
    await loadPreset(page, 'Collection receipt');
    await deselect(page);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(band(page, 'Payments')).toHaveCount(0);
    await expect(elementsOn(page, 'Header')).toHaveCount(1);
  });

  test('band names and template name follow the interface language', async ({ page }) => {
    await toolsPanel(page).getByRole('group', { name: 'Language' }).getByRole('button', { name: 'tr' }).click();
    await toolsPanel(page).getByRole('button', { name: 'Hazır şablonlar…' }).click();
    await page.getByRole('dialog', { name: 'Hazır şablonlar' }).getByRole('button', { name: /^Tahsilat makbuzu/ }).click();
    await expect(page.getByLabel('Ödemeler bandı', { exact: true })).toBeVisible();
    await expect(page.getByLabel('İmzalar bandı', { exact: true })).toBeVisible();
    await expect(toolsPanel(page).getByRole('button', { name: 'Güncelle: "Tahsilat makbuzu"' })).toHaveCount(0);
  });
});
