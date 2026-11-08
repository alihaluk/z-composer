import { expect, test, type Page } from '@playwright/test';

// The built package (dist-lib) in a host page, configured by query parameters (e2e/host/main.tsx).
interface Host { saved: { template: { bands: unknown[]; fieldsUsed?: { path: string }[] }; zpl: string }[]; changes: unknown[] }
const host = (page: Page) => page.evaluate(() => (window as unknown as { host: Host }).host);
const designer = (page: Page, n = 1) => page.locator(`[data-designer="${n}"]`);

async function openHost(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await expect(designer(page).locator('.zc-root')).toBeVisible();
}

test.describe('embedded designer', () => {
  test('a fixed language hides the switch, and the host page keeps its styles', async ({ page }) => {
    await openHost(page, 'lang=tr');
    await expect(designer(page).getByRole('heading', { name: 'Araç Kutusu' })).toBeVisible();
    await expect(designer(page).getByRole('group', { name: /^(Language|Dil)$/ })).toHaveCount(0);

    // No global reset: the host's heading, list and font are untouched.
    const title = page.locator('.host-title');
    await expect(title).toHaveCSS('font-size', '28px');
    await expect(title).toHaveCSS('font-family', 'Georgia, serif');
    await expect(page.locator('.host-list')).toHaveCSS('list-style-type', 'disc');
    // And the designer still has its own look inside the host.
    await expect(designer(page).getByRole('heading', { name: 'Araç Kutusu' })).toHaveCSS('text-transform', 'uppercase');
  });

  test('onSave hands over the template with its fields and the ZPL', async ({ page }) => {
    await openHost(page, 'lang=en&save=1&template=preset');
    await expect(designer(page).getByLabel('Totals band', { exact: true })).toBeVisible();
    await designer(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(designer(page).getByRole('status').filter({ hasText: 'Template saved' })).toBeVisible();

    const { saved } = await host(page);
    expect(saved).toHaveLength(1);
    expect(saved[0].template.bands).toHaveLength(6);
    expect(saved[0].template.fieldsUsed?.map(f => f.path)).toContain('Totals.Grand');
    expect(saved[0].zpl).toMatch(/^\^XA\n\^FX ZC:TEMPLATE spec=1 dpi=203/);
    expect(saved[0].zpl).toContain('{{Totals.Grand|fmt=N2}}');
  });

  test('onChange reports every change', async ({ page }) => {
    await openHost(page, 'lang=en');
    expect((await host(page)).changes).toHaveLength(0);
    await designer(page).getByRole('button', { name: 'Text', exact: true }).click();
    await designer(page).getByRole('button', { name: 'Box', exact: true }).click();
    await expect.poll(async () => (await host(page)).changes.length).toBe(2);
  });

  test('without storage there is no saved-templates list and nothing is kept', async ({ page }) => {
    await openHost(page, 'lang=en&storage=none');
    await expect(designer(page).getByText('Saved Templates')).toHaveCount(0);
    await designer(page).getByRole('button', { name: 'Text', exact: true }).click();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('zcomposer')))).toEqual([]);
  });

  test('a locked catalog can be used but not changed', async ({ page }) => {
    await openHost(page, 'lang=en&catalog=locked&catalogData=small&locale=tr-TR');
    const sidebar = designer(page).locator('aside').first();
    await expect(sidebar.getByText('Adisyon')).toBeVisible();
    for (const name of ['Edit', 'From sample JSON', 'From JSON Schema', 'Open catalog', 'Save catalog']) {
      await expect(sidebar.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    // A ready-made template keeps the host's catalog.
    await designer(page).getByRole('region', { name: 'Template commands' }).getByRole('button', { name: 'Ready-made templates…' }).click();
    await page.getByRole('dialog', { name: 'Ready-made templates' }).getByRole('button', { name: /^Collection receipt/ }).click();
    await expect(designer(page).getByLabel('Payments band', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Adisyon')).toBeVisible();
    // Back to an empty design for the field list below.
    page.once('dialog', d => void d.accept());
    await designer(page).getByRole('button', { name: 'New', exact: true }).click();

    // The field list still adds its fields, with the host's locale.
    await sidebar.getByRole('region', { name: 'Fields' }).getByRole('button', { name: /^Toplam/ }).click();
    await expect(designer(page).getByLabel('Header band', { exact: true }).getByRole('button')).toHaveText(['1.234,50']);
  });

  test('two designers on one page keep their own language and state', async ({ page }) => {
    await openHost(page, 'two=1&lang1=tr&lang2=en&storage=none');
    await expect(designer(page, 1).getByRole('heading', { name: 'Araç Kutusu' })).toBeVisible();
    await expect(designer(page, 2).getByRole('heading', { name: 'Toolbox' })).toBeVisible();

    await designer(page, 1).getByRole('button', { name: 'Metin', exact: true }).click();
    await expect(designer(page, 1).getByLabel('Üst bilgi bandı', { exact: true }).getByRole('button')).toHaveCount(1);
    await expect(designer(page, 2).getByLabel('Header band', { exact: true }).getByRole('button')).toHaveCount(0);
  });

  test('the barcode chunk of the package loads for the preview', async ({ page }) => {
    await openHost(page, 'lang=en&template=preset');
    await designer(page).getByRole('button', { name: 'Preview ZPL' }).click();
    const dialog = page.getByRole('dialog', { name: 'ZPL Preview' });
    await expect(dialog.getByLabel('Print preview', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Failed to render preview')).toHaveCount(0);
  });

  test('shortcuts act only on the designer in use', async ({ page }) => {
    await openHost(page, 'two=1&lang1=en&lang2=en&storage=none');
    const elements = (n: number) => designer(page, n).getByLabel('Header band', { exact: true }).getByRole('button');
    for (const n of [1, 2]) {
      const box = designer(page, n).locator('aside').first().getByRole('button', { name: 'Box', exact: true });
      await box.click();
      await box.click();
    }
    await elements(1).nth(1).click();
    await elements(2).nth(1).click();

    // The second designer was used last: Delete leaves the first one alone, also with focus on the page.
    await page.keyboard.press('Delete');
    await expect(elements(2)).toHaveCount(1);
    await expect(elements(1)).toHaveCount(2);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ControlOrMeta+z');
    await expect(elements(2)).toHaveCount(2);
    await expect(elements(1)).toHaveCount(2);

    // A click on the host page gives the keyboard back to the host.
    await page.locator('.host-title').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(elements(2)).toHaveCount(2);
    await expect(elements(1)).toHaveCount(2);

    // A dialog in one designer does not turn off the other one's state, and blocks its own shortcuts.
    await elements(1).nth(1).click();
    await designer(page, 1).getByRole('button', { name: 'Preview ZPL' }).click();
    await page.keyboard.press('Delete');
    await expect(elements(1)).toHaveCount(2);
  });
});

