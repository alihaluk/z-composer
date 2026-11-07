import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { acceptConfirm, band, bandOf, design, designWhere, elementsOn, field, fill, loadPreset, open, tool, toolsPanel, topBar, type Template } from './helpers';

/** Saving goes through a download instead of the browser's save dialog. */
const noSavePicker = (page: Page) => page.addInitScript(() => { delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker; });

async function chooseFile(page: Page, button: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser');
  await topBar(page).getByRole('button', { name: button, exact: true }).click();
  await (await chooser).setFiles(file);
}

const json = (name: string, data: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });

test.describe('files', () => {
  test('export writes the template with its fields, import brings it back', async ({ page }) => {
    await noSavePicker(page);
    await open(page);
    await loadPreset(page);

    const download = page.waitForEvent('download');
    await topBar(page).getByRole('button', { name: 'Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('e-Fatura.json');
    const exported = JSON.parse(readFileSync((await file.path())!, 'utf8')) as Template & { fieldsUsed: { path: string }[] };
    expect(exported.bands.map(b => b.name)).toEqual(['Header', 'Lines', 'VAT title', 'VAT lines', 'Totals', 'Footer']);
    expect(exported.fieldsUsed.map(f => f.path)).toContain('Document.QrContent');

    acceptConfirm(page, /Clear the current design/);
    await topBar(page).getByRole('button', { name: 'New', exact: true }).click();
    await expect(band(page, 'Totals')).toHaveCount(0);

    await chooseFile(page, 'Import', json('copy.json', exported));
    await expect(band(page, 'Totals')).toBeVisible();
    const imported = await designWhere(page, t => t.bands.length === 6);
    expect(bandOf(imported, 'Totals').elements.length).toBe(bandOf(exported, 'Totals').elements.length);
  });

  test('a broken file is refused with a message', async ({ page }) => {
    await open(page);
    await chooseFile(page, 'Import', json('bad.json', { schemaVersion: 2, bands: 'no' }));
    await expect(topBar(page).getByRole('status')).toContainText('Template could not be opened');
    await expect(band(page, 'Header')).toBeVisible();
  });

  test('templates are saved, updated, opened and deleted in the browser', async ({ page }) => {
    await open(page);
    await tool(page, 'Text').click();
    const name = toolsPanel(page).getByLabel('New template name');
    await name.fill('Fiş A');
    await name.press('Enter');
    await expect(toolsPanel(page).getByRole('status')).toHaveText('"Fiş A" saved');

    await tool(page, 'Box').click();
    await toolsPanel(page).getByRole('button', { name: 'Update "Fiş A"' }).click();

    await loadPreset(page);
    await name.fill('Fatura');
    await toolsPanel(page).getByRole('button', { name: 'Save as new' }).click();
    const list = toolsPanel(page).locator('section').filter({ has: page.getByRole('heading', { name: 'Saved Templates' }) }).getByRole('listitem');
    // Kept in the order they were saved.
    await expect(list).toHaveText(['Fiş A', 'Fatura']);

    await list.filter({ hasText: 'Fiş A' }).getByRole('button', { name: 'Fiş A', exact: true }).click();
    await expect(elementsOn(page, 'Header')).toHaveCount(2);

    await page.reload();
    await expect(list).toHaveCount(2);
    acceptConfirm(page, /Delete "Fatura"\?/);
    await list.filter({ hasText: 'Fatura' }).getByRole('button', { name: 'Delete Fatura' }).click();
    await expect(list).toHaveCount(1);
  });

  test('the design survives a reload as a draft', async ({ page }) => {
    await open(page);
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await fill(field(page, 'X (mm)'), '12');
    await designWhere(page, t => bandOf(t, 'Header').elements[0]?.x === 12);

    await page.reload();
    await expect(elementsOn(page, 'Header')).toHaveCount(1);
    expect(bandOf(await design(page), 'Header').elements[0].x).toBe(12);
    await expect(page.getByText('Start designing')).toHaveCount(0);
  });
});

test('damaged browser storage does not break the designer', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const good = { schemaVersion: 2, printer: { widthMm: 72, dpi: 203 }, bands: [{ id: 'b', name: 'Header', height: 10, elements: [] }] };
    const bad = { ...good, bands: [{ ...good.bands[0], elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 3, content: 42 }] }] };
    localStorage.setItem('zcomposer_templates_v2', JSON.stringify([{ name: 'Good', template: good }, { name: 'Bad', template: bad }, 'junk']));
    localStorage.setItem('zcomposer_templates_v2_draft', '{"template": {"schemaVersion": 2, "bands": 5}}');
    localStorage.setItem('zcomposer_templates_v2_catalog', 'not json');
  });
  await open(page);
  // The broken draft and catalog are ignored, the broken saved template is not listed.
  await expect(page.getByText('Start designing')).toBeVisible();
  await expect(toolsPanel(page).getByText('Genel fatura')).toBeVisible();
  const list = toolsPanel(page).locator('section').filter({ has: page.getByRole('heading', { name: 'Saved Templates' }) }).getByRole('listitem');
  await expect(list).toHaveText(['Good']);
  await list.getByRole('button', { name: 'Good', exact: true }).click();
  await expect(band(page, 'Header')).toBeVisible();

  // Saving keeps the entries this version cannot open, for a version that can.
  const name = toolsPanel(page).getByLabel('New template name');
  await name.fill('New');
  await name.press('Enter');
  await expect(list).toHaveText(['Good', 'New']);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('zcomposer_templates_v2')!) as unknown[]);
  expect(stored.map(e => (typeof e === 'object' && e ? (e as { name: string }).name : e))).toEqual(['Good', 'New', 'Bad', 'junk']);
});
