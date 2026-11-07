import { expect, test, type Page } from '@playwright/test';
import { bandLabel, bandOf, designWhere, elementsOn, field, fill, open, propertiesPanel, templateZpl, tool } from './helpers';

const content = (page: Page) => propertiesPanel(page).getByRole('radiogroup', { name: 'Content' });
// The content's field select comes before the condition's.
const contentField = (page: Page) => field(page, 'Field').first();

/** A 2×2 black PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAAC0lEQVR42mNgQAcAABIAAeRVjecAAAAASUVORK5CYII=', 'base64');

test.describe('content', () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    // Sample values in a fixed culture.
    await fill(field(page, 'Preview culture'), 'tr-TR');
  });

  test('a text bound to a field shows its sample value with the chosen format', async ({ page }) => {
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await content(page).getByRole('radio', { name: 'Field', exact: true }).click();
    await contentField(page).selectOption('Totals.Grand');
    await field(page, 'Format').selectOption('N2');
    await expect(propertiesPanel(page).getByText('Sample (tr-TR):')).toContainText('2.845,52');
    await expect(elementsOn(page, 'Header').first()).toContainText('2.845,52');

    await field(page, 'Culture-invariant (e.g. QR content)').check();
    await expect(propertiesPanel(page).getByText('Sample (invariant):')).toContainText('2,845.52');
    expect(await templateZpl(page)).toContain('{{Totals.Grand|fmt=N2|inv}}');
  });

  test('a custom date pattern', async ({ page }) => {
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await content(page).getByRole('radio', { name: 'Field', exact: true }).click();
    await contentField(page).selectOption('Document.Date');
    await field(page, 'Format').selectOption('custom');
    const pattern = propertiesPanel(page).getByPlaceholder('dd.MM.yyyy HH:mm');
    await fill(pattern, 'dd/MM HH:mm');
    await expect(propertiesPanel(page).getByText('Sample (tr-TR):')).toContainText('13/11 14:37');
    expect(await templateZpl(page)).toContain('{{Document.Date|fmt=dd/MM HH:mm}}');
  });

  test('composed content joins text and fields in order', async ({ page }) => {
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await content(page).getByRole('radio', { name: 'Static' }).click();
    await fill(propertiesPanel(page).getByRole('textbox').first(), 'No: ');
    // Composing starts from the static text.
    await content(page).getByRole('radio', { name: 'Composed' }).click();
    await expect(propertiesPanel(page).getByPlaceholder('Static text, spaces included')).toHaveValue('No: ');

    await propertiesPanel(page).getByRole('button', { name: 'Field', exact: true }).click();
    await contentField(page).selectOption('Document.Number');
    await propertiesPanel(page).getByRole('button', { name: 'Text', exact: true }).click();
    await fill(propertiesPanel(page).getByPlaceholder('Static text, spaces included').last(), ' / ');
    await propertiesPanel(page).getByRole('button', { name: 'Field', exact: true }).click();
    await field(page, 'Field').nth(1).selectOption('Document.Date');
    // The string field has no format; the date field's is the only one.
    await field(page, 'Format').selectOption('dd.MM.yyyy');

    await expect(propertiesPanel(page).getByText('Sample (tr-TR):')).toContainText('No: FTR2026000000123 / 13.11.2026');
    await expect(elementsOn(page, 'Header').first()).toContainText('No: FTR2026000000123 / 13.11.2026');

    // Parts can be reordered and removed.
    await propertiesPanel(page).getByRole('button', { name: 'Move up' }).nth(1).click();
    await expect(propertiesPanel(page).getByText('Sample (tr-TR):')).toContainText('FTR2026000000123No:  / 13.11.2026');
    await propertiesPanel(page).getByRole('button', { name: 'Remove part' }).last().click();
    await propertiesPanel(page).getByRole('button', { name: 'Remove part' }).last().click();
    await expect(propertiesPanel(page).getByText('Sample (tr-TR):')).toContainText('FTR2026000000123No:');

    expect(await templateZpl(page)).toContain('^FD{{Document.Number}}No: ^FS');
  });

  test('fields of a repeating band are relative to the item', async ({ page }) => {
    await bandLabel(page, 'Lines').click();
    await tool(page, 'Text').click();
    await elementsOn(page, 'Lines').first().click();
    await content(page).getByRole('radio', { name: 'Field', exact: true }).click();
    const options = await contentField(page).locator('option').allTextContents();
    expect(options).toContain('Ürün adı · Product.Name');
    expect(options).toContain('Belge no · $.Document.Number');
    await contentField(page).selectOption('Product.Name');
    await expect(elementsOn(page, 'Lines').first()).toContainText('Süt 1L');
  });

  test('an element condition is written around its field', async ({ page }) => {
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await field(page, 'Field').last().selectOption('Totals.Discount');
    // Number fields default to "not zero".
    await expect(field(page, 'Show when')).toHaveValue('notZero');
    expect(await templateZpl(page)).toMatch(/\^FX ZC:IF Totals\.Discount notZero\n\^FO[^\n]+\n\^FX ZC:ENDIF/);
  });

  test('a barcode element switches between Code 128 and QR', async ({ page }) => {
    await tool(page, 'Barcode').click();
    await elementsOn(page, 'Header').first().click();
    await content(page).getByRole('radio', { name: 'Static' }).click();
    await fill(propertiesPanel(page).getByRole('textbox').first(), '8690000000011');
    await fill(field(page, 'Bar width (dots)'), '3');
    await expect(propertiesPanel(page).getByText(/^Printed size \(sample data\)/)).toBeVisible();
    await propertiesPanel(page).getByRole('button', { name: 'Fit box' }).click();
    await designWhere(page, t => bandOf(t, 'Header').elements[0]?.moduleWidth === 3);
    expect(await propertiesPanel(page).locator('pre').textContent()).toContain('^BY3');

    await field(page, 'Barcode type').selectOption('qr');
    const el = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements[0]?.barcodeType === 'qr'), 'Header').elements[0];
    expect(el.width).toBe(el.height);
    await expect(field(page, 'Height (mm)')).toHaveCount(0);
    expect(await propertiesPanel(page).locator('pre').textContent()).toContain('^BQN');
  });

  test('a QR is set up as the GİB karekod in the top-right corner', async ({ page }) => {
    await tool(page, 'QR code').click();
    await elementsOn(page, 'Header').first().click();
    await expect(propertiesPanel(page).getByText('Choose the catalog field that holds the karekod JSON above.')).toBeVisible();
    await propertiesPanel(page).getByRole('button', { name: 'Set up as GİB karekod' }).click();
    await expect(propertiesPanel(page).getByText('Choose the catalog field that holds the karekod JSON above.')).toHaveCount(0);

    const el = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements[0]?.dataSource === 'Document.QrContent'), 'Header').elements[0];
    // 72 mm page: x = 72 − size − 2, y = 1.
    expect(el).toMatchObject({ y: 1, isDynamic: true });
    expect(el.x + el.width).toBeCloseTo(70, 1);
    expect(await templateZpl(page)).toContain('{{Document.QrContent}}');
  });

  test('an image is uploaded as a fixed bitmap or bound to an image field', async ({ page }) => {
    await tool(page, 'Image').click();
    await elementsOn(page, 'Header').first().click();
    await field(page, 'Upload image').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await expect(field(page, 'Black threshold')).toBeVisible();
    await expect(elementsOn(page, 'Header').first().locator('img')).toBeVisible();
    expect(await propertiesPanel(page).locator('pre').textContent()).toContain('^GFA');

    await field(page, 'Image supplied at print time').selectOption('Company.Logo');
    await expect(field(page, 'Upload image')).toHaveCount(0);
    expect(await templateZpl(page)).toContain('^FX ZC:IMAGE key=Company.Logo');
  });
});
