import { expect, test } from '@playwright/test';
import { acceptConfirm, band, bandLabel, bandOf, design, designWhere, field, fill, open, propertiesPanel, templateZpl, tool } from './helpers';

test.describe('bands', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('a band is renamed, resized, repeated and given a condition', async ({ page }) => {
    await bandLabel(page, 'Footer').click();
    await expect(propertiesPanel(page).getByText('Layers')).toBeVisible();

    await fill(field(page, 'Name'), 'Notes');
    await fill(field(page, 'Height (mm)'), '12');
    await expect(bandLabel(page, 'Notes')).toHaveAttribute('title', /^Notes · 12 mm/);

    await field(page, 'Repeat').selectOption('VatBreakdown');
    // The band's condition only offers document fields.
    await field(page, 'Field').selectOption('Document.Note');
    await expect(field(page, 'Show when')).toHaveValue('notEmpty');
    await expect(bandLabel(page, 'Notes')).toHaveAttribute('title', /Repeat: KDV dökümü\nCondition: Document\.Note · Not empty/);

    const notes = bandOf(await designWhere(page, t => t.bands.some(b => b.name === 'Notes' && !!b.condition)), 'Notes');
    expect(notes).toMatchObject({ height: 12, repeat: 'VatBreakdown', condition: { path: 'Document.Note', op: 'notEmpty' } });

    const zpl = await templateZpl(page);
    expect(zpl).toMatch(/\^FX ZC:IF Document\.Note notEmpty\n\^FX ZC:BAND id=\S+ height=\d+ repeat=VatBreakdown/);
  });

  test('bands are added, moved and deleted', async ({ page }) => {
    await propertiesPanel(page).getByRole('button', { name: 'Add band' }).click();
    const t = await designWhere(page, d => d.bands.length === 4);
    const added = t.bands[3].name;

    await bandLabel(page, 'Header').click();
    await propertiesPanel(page).getByRole('button', { name: 'Add below' }).click();
    await designWhere(page, d => d.bands.length === 5);

    await bandLabel(page, 'Footer').click();
    await propertiesPanel(page).getByRole('button', { name: 'Up' }).click();
    await designWhere(page, d => d.bands.findIndex(b => b.name === 'Footer') === 3);

    // An empty band goes without asking; one with elements asks first.
    await bandLabel(page, added).click();
    await propertiesPanel(page).getByRole('button', { name: 'Delete' }).click();
    await designWhere(page, d => d.bands.length === 4);

    await bandLabel(page, 'Footer').click();
    await tool(page, 'Box').click();
    await bandLabel(page, 'Footer').click();
    acceptConfirm(page, /Delete the "Footer" band/);
    await propertiesPanel(page).getByRole('button', { name: 'Delete' }).click();
    await expect(band(page, 'Footer')).toHaveCount(0);
  });

  test('the layer list selects and locks elements', async ({ page }) => {
    await tool(page, 'Text').click();
    await tool(page, 'Box').click();
    await bandLabel(page, 'Header').click();
    const layers = propertiesPanel(page).getByRole('listitem');
    await expect(layers).toHaveCount(2);
    // Top-most first.
    await expect(layers.nth(0)).toContainText('Box');
    await layers.nth(0).getByRole('button', { name: 'Lock' }).click();
    await designWhere(page, d => !!bandOf(d, 'Header').elements[1]?.locked);

    await layers.nth(1).getByRole('button', { name: /Text/ }).click();
    await expect(propertiesPanel(page).getByText('Position and size')).toBeVisible();
    expect(bandOf(await design(page), 'Header').elements[0].locked).toBeUndefined();
  });
});
