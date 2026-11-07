import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { elementsOn, field, fill, loadPreset, open, propertiesPanel, toolsPanel, topBar } from './helpers';

/** axe-core findings of the page, or of the open dialog, as "rule: element" lines. */
async function violations(page: Page, dialog = false) {
  let builder = new AxeBuilder({ page });
  if (dialog) builder = builder.include('[role=dialog]');
  const { violations: found } = await builder.analyze();
  return found.flatMap(v => v.nodes.map(n => `${v.id}: ${n.target.join(' ')}`));
}

test.describe('accessibility (axe-core)', () => {
  test('the designer, an element and the design check have no violations', async ({ page }) => {
    await open(page);
    expect(await violations(page)).toEqual([]);

    await loadPreset(page);
    await elementsOn(page, 'Header').nth(3).click();
    expect(await violations(page)).toEqual([]);

    // A finding in the panel and on the canvas.
    await fill(field(page, 'X (mm)'), '60');
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('the dialogs have no violations', async ({ page }) => {
    await open(page);
    await loadPreset(page);
    await page.getByRole('button', { name: 'Preview ZPL' }).click();
    await expect(page.getByRole('dialog', { name: 'ZPL Preview' }).getByLabel('Print preview', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await violations(page, true)).toEqual([]);
    await page.keyboard.press('Escape');

    await toolsPanel(page).getByRole('button', { name: 'Edit' }).click();
    expect(await violations(page, true)).toEqual([]);
    await page.keyboard.press('Escape');

    await topBar(page).getByRole('button', { name: 'Ready-made templates…' }).click();
    expect(await violations(page, true)).toEqual([]);
  });

  test('the Turkish interface has no violations', async ({ page }) => {
    await page.goto('./?lng=tr');
    await toolsPanel(page).getByRole('region', { name: 'Alanlar' }).getByRole('button', { name: /^Belge no/ }).click();
    expect(await violations(page)).toEqual([]);
  });
});
