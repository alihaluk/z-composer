import { expect, test, type Page } from '@playwright/test';
import { band, catalogAction, drag, field, loadPreset, open, tool, topBar, toolsPanel } from './helpers';

const KEY = 'zcomposer_templates_v2';
const doc = (element: object) => JSON.stringify({ schemaVersion: 2, printer: { widthMm: 72, dpi: 203 }, bands: [{ id: 'b', name: 'Header', height: 10, elements: [{ id: 'e', type: 'image', x: 0, y: 0, width: 10, height: 3, ...element }] }] });

async function importTemplate(page: Page, text: string) {
  const chooser = page.waitForEvent('filechooser');
  await topBar(page).getByRole('button', { name: 'Import', exact: true }).click();
  await (await chooser).setFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

async function importSchema(page: Page, text: string) {
  const chooser = page.waitForEvent('filechooser');
  await (await catalogAction(page, 'From JSON Schema')).click();
  await (await chooser).setFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

/** Every request that leaves the site. */
function outside(page: Page) {
  const urls: string[] = [];
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== 'localhost') urls.push(r.url()); });
  return urls;
}

test.describe('untrusted files', () => {
  test('the page carries a content security policy and normal use breaks none of it', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { violations: string[] }).violations = [];
      document.addEventListener('securitypolicyviolation', e => (window as unknown as { violations: string[] }).violations.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    const urls = outside(page);
    await open(page);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'none'.*img-src 'self' data:/);
    await loadPreset(page);
    await page.getByRole('button', { name: 'Preview ZPL' }).click();
    await expect(page.getByLabel('Print preview', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');

    // Dragging, uploading an image and saving a file are the flows with the most browser features.
    await drag(page, tool(page, 'Box'), await band(page, 'Footer').boundingBox().then(b => ({ x: b!.x + 40, y: b!.y + 10 })));
    await tool(page, 'Image').click();
    await field(page, 'Upload image').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAAC0lEQVR42mNgQAcAABIAAeRVjecAAAAASUVORK5CYII=', 'base64') });
    await expect(page.locator('main img').first()).toBeVisible();
    await page.evaluate(() => { delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
    const download = page.waitForEvent('download');
    await topBar(page).getByRole('button', { name: 'Export' }).click();
    await download;

    expect(await page.evaluate(() => (window as unknown as { violations: string[] }).violations)).toEqual([]);
    expect(urls).toEqual([]);
  });

  test('a template with a remote image is refused and calls nobody', async ({ page }) => {
    const urls = outside(page);
    await open(page);
    await importTemplate(page, doc({ imageBase64: 'https://tracker.invalid/pixel.png' }));
    await expect(topBar(page).getByRole('status')).toContainText('imageBase64 must be an embedded');
    await expect(page.locator('main img')).toHaveCount(0);
    expect(urls).toEqual([]);
  });

  test('a stored draft with a remote image is ignored', async ({ page }) => {
    await page.addInitScript(([key, draft]) => localStorage.setItem(`${key}_draft`, draft), [KEY, JSON.stringify({ template: JSON.parse(doc({ imageBase64: 'https://tracker.invalid/pixel.png' })) })]);
    const urls = outside(page);
    await open(page);
    await expect(page.getByText('Start designing')).toBeVisible();
    expect(urls).toEqual([]);
  });

  test('a broken bitmap is refused and the designer keeps working, also after a reload', async ({ page }) => {
    await open(page);
    await importTemplate(page, doc({ bitmap: { width: 2, height: 2, data: '%%%bad' } }));
    await expect(topBar(page).getByRole('status')).toContainText('bitmap must have');
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Toolbox' })).toBeVisible();
  });

  test('a stored draft that was saved broken no longer blocks the designer', async ({ page }) => {
    await page.addInitScript(([key, draft]) => localStorage.setItem(`${key}_draft`, draft), [KEY, JSON.stringify({ template: JSON.parse(doc({ bitmap: { width: 2, height: 2, data: '%%%bad' } })) })]);
    await open(page);
    await expect(page.getByText('Start designing')).toBeVisible();
  });

  test('a huge image box does not freeze the page', async ({ page }) => {
    await open(page);
    await importTemplate(page, doc({ width: 200000, height: 200000, bitmap: { width: 2, height: 2, data: 'AAAAAA==' } }));
    await expect(topBar(page).getByRole('status')).toContainText('width must be');
    await tool(page, 'Text').click();
  });

  test('a JSON Schema cannot change Object.prototype', async ({ page }) => {
    await open(page);
    await importSchema(page, '{"properties":{"a":{"type":"string"},"__proto__":{"type":"object","properties":{"isAdmin":{"type":"boolean"},"hidden":{"type":"boolean"}}}}}');
    await expect(toolsPanel(page).getByRole('status').last()).toContainText('Catalog loaded: 1 fields');
    expect(await page.evaluate(() => [({} as { isAdmin?: boolean }).isAdmin, ({} as { hidden?: boolean }).hidden])).toEqual([undefined, undefined]);
    await expect(page.locator('[hidden]')).toHaveCount(0);
  });

  test('a JSON Schema that expands without end is refused at once', async ({ page }) => {
    await open(page);
    const properties = Object.fromEntries('abcdefghijkl'.split('').map(k => [k, { $ref: '#/definitions/N' }]));
    await importSchema(page, JSON.stringify({ definitions: { N: { type: 'object', properties } }, $ref: '#/definitions/N' }));
    await expect(toolsPanel(page).getByRole('status').last()).toContainText('too many fields');
  });

  test('HTML in a file stays text', async ({ page }) => {
    const html = '<img src=x onerror="window.xss=1">';
    await open(page);
    await importTemplate(page, JSON.stringify({ schemaVersion: 2, printer: { widthMm: 72, dpi: 203 }, bands: [{ id: 'b', name: html, height: 10, elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 3, content: html }] }] }));
    await expect(page.locator('main')).toContainText('onerror');
    await page.getByRole('button', { name: 'Preview ZPL' }).click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { xss?: number }).xss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });
});
