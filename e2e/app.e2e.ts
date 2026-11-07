import { expect, test } from '@playwright/test';
import { band, bandLabel, open, propertiesPanel, toolsPanel } from './helpers';

test.describe('app shell', () => {
  test('opens with an empty three-band template and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page);

    await expect(page.getByText('Start designing')).toBeVisible();
    for (const name of ['Header', 'Lines', 'Footer']) await expect(band(page, name)).toBeVisible();
    await expect(bandLabel(page, 'Lines')).toHaveAttribute('title', /Repeat: Lines/);
    await expect(propertiesPanel(page).getByText('Printable width (mm)')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('switches the interface language and keeps Turkish upper case', async ({ page }) => {
    await open(page);
    await toolsPanel(page).getByRole('group', { name: 'Language' }).getByRole('button', { name: 'tr' }).click();
    await expect(page.getByRole('heading', { name: 'Araç Kutusu' })).toBeVisible();
    await expect(page.locator('.zc-root')).toHaveAttribute('lang', 'tr');
    // Headings are upper-cased by CSS, which follows lang: with "tr" an i becomes İ.
    expect(await page.getByRole('heading', { name: 'Araç Kutusu' }).evaluate(el => getComputedStyle(el).textTransform)).toBe('uppercase');

    // The choice is remembered (the lng query parameter would override it).
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Araç Kutusu' })).toBeVisible();
  });

  test('the empty state loads the invoice preset', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Load the preset' }).click();
    for (const name of ['Header', 'Lines', 'VAT title', 'VAT lines', 'Totals', 'Footer']) await expect(band(page, name)).toBeVisible();
    await expect(page.getByText('Start designing')).toHaveCount(0);
  });

  test('side panels collapse and come back', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Hide tools panel' }).click();
    await expect(page.getByRole('heading', { name: 'Toolbox' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Hide properties panel' }).click();
    await expect(page.getByText('Printable width (mm)')).toHaveCount(0);

    await page.getByRole('button', { name: 'Show tools panel' }).click();
    await page.getByRole('button', { name: 'Show properties panel' }).click();
    await expect(page.getByRole('heading', { name: 'Toolbox' })).toBeVisible();
    await expect(page.getByText('Printable width (mm)')).toBeVisible();
  });

  test('zoom buttons change the canvas scale', async ({ page }) => {
    await open(page);
    const zoom = page.getByRole('group', { name: 'Zoom' });
    const level = zoom.locator('span');
    const before = Number((await level.textContent())!.replace('%', ''));
    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect(level).not.toHaveText(`${before}%`);
    const after = Number((await level.textContent())!.replace('%', ''));
    expect(after).toBeGreaterThan(before);
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    await zoom.getByRole('button', { name: 'Zoom out' }).click();
    expect(Number((await level.textContent())!.replace('%', ''))).toBeLessThan(after);
  });

  test('the paper width changes the page width', async ({ page }) => {
    await open(page);
    const header = band(page, 'Header');
    const before = (await header.boundingBox())!.width;
    await propertiesPanel(page).getByRole('button', { name: '48 mm' }).click();
    await expect.poll(async () => (await header.boundingBox())!.width).toBeLessThan(before);
  });
});
