import { expect, test, type Page } from '@playwright/test';
import { bandOf, design, elementsOn, loadPreset, open, tool } from './helpers';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'ZPL Preview' });
const image = (page: Page) => dialog(page).getByLabel('Print preview');

/** Share of dark pixels in the rendered label. */
const inked = (page: Page) => image(page).evaluate((canvas: HTMLCanvasElement) => {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 128) dark++;
  return dark / (data.length / 4);
});

test.describe('preview', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('renders the preset with sample data and with field names', async ({ page }) => {
    await loadPreset(page);
    await page.getByRole('button', { name: 'Preview ZPL' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(image(page)).toBeVisible({ timeout: 15_000 });
    await expect(dialog(page).getByText('Failed to render preview')).toHaveCount(0);

    const code = await dialog(page).locator('pre').textContent();
    expect(code).toMatch(/^\^XA/);
    expect(code).toContain('^FX ZC:TEMPLATE spec=1 dpi=203');
    expect(code).toContain('{{Document.QrContent}}');

    // A 72 mm label at 203 dpi is 576 dots wide.
    expect(await image(page).evaluate((c: HTMLCanvasElement) => c.width)).toBe(576);
    const sample = await inked(page);
    expect(sample).toBeGreaterThan(0.02);

    await dialog(page).getByRole('radio', { name: 'Field names' }).click();
    await expect.poll(() => inked(page)).not.toBe(sample);
  });

  test('closes with Escape, keeps focus inside and gives it back', async ({ page }) => {
    await tool(page, 'Box').click();
    await elementsOn(page, 'Header').first().click();
    const opener = page.getByRole('button', { name: 'Preview ZPL' });
    await opener.click();
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeFocused();

    // Tab cycles inside the dialog.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog(page).evaluate(d => d.contains(document.activeElement))).toBe(true);
    }
    // Editor shortcuts are off while the dialog is open.
    await page.keyboard.press('Delete');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(elementsOn(page, 'Header')).toHaveCount(1);
    expect(bandOf(await design(page), 'Header').elements).toHaveLength(1);
  });

  test('the culture changes sample numbers', async ({ page }) => {
    await loadPreset(page);
    await page.getByRole('button', { name: 'Preview ZPL' }).click();
    await expect(image(page)).toBeVisible({ timeout: 15_000 });
    const culture = dialog(page).getByLabel('Culture');
    await culture.fill('tr-TR');
    await culture.blur();
    const tr = await image(page).evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await culture.fill('en-US');
    await culture.blur();
    await expect.poll(() => image(page).evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(tr);
  });
});
