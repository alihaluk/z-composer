import { expect, test, type Page } from '@playwright/test';
import { band, bandLabel, bandOf, catalogAction, design, designWhere, drag, elementsOn, field, fill, open, propertiesPanel, templateZpl, toolsPanel } from './helpers';

const list = (page: Page) => toolsPanel(page).getByRole('region', { name: 'Fields' });
/** A field of the list by its label. */
const fieldItem = (page: Page, label: string) => list(page).getByRole('button', { name: new RegExp(`^${label.replace(/[.()]/g, '\\$&')}`) });
const search = (page: Page) => toolsPanel(page).getByRole('searchbox', { name: 'Search fields' });
const center = async (page: Page, name: string) => {
  const b = (await band(page, name).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe('field list', () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await fill(field(page, 'Preview culture'), 'tr-TR');
  });

  test('lists the catalog fields in groups, arrays marked as repeating', async ({ page }) => {
    await expect(list(page).getByRole('region', { name: 'Document' })).toBeVisible();
    await expect(list(page).getByRole('region', { name: 'Satırlar' })).toBeVisible();
    await expect(list(page).getByRole('region', { name: 'KDV dökümü' })).toBeVisible();
    // 37 fields in the default catalog, two of them arrays.
    await expect(list(page).getByRole('button')).toHaveCount(35);
    // The path is in the tooltip; the list shows labels.
    await expect(fieldItem(page, 'Firma adı')).toHaveAttribute('title', /^Company\.Name · /);
  });

  test('search ignores case, Turkish letters and accents, and matches paths', async ({ page }) => {
    await search(page).fill('MUSTERI');
    await expect(list(page).getByRole('button')).toHaveCount(4);
    await search(page).fill('urun');
    await expect(list(page).getByRole('button')).toHaveCount(3);
    await search(page).fill('satirlar');
    await expect(list(page).getByRole('button')).toHaveCount(10);
    await search(page).fill('totals.gr');
    await expect(list(page).getByRole('button')).toHaveText([/Genel toplam/]);
    await search(page).fill('yok böyle bir alan');
    await expect(list(page)).toContainText('No matching field');
    await search(page).fill('');
    await expect(list(page).getByRole('button')).toHaveCount(35);
  });

  test('a clicked field becomes a bound element on the selected band', async ({ page }) => {
    await bandLabel(page, 'Footer').click();
    await fieldItem(page, 'Firma adı').click();
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
    await expect(elementsOn(page, 'Footer').first()).toContainText('Örnek Gıda A.Ş.');
    // The new element is selected and shows its binding.
    await expect(field(page, 'Field').first()).toHaveValue('Company.Name');
    expect(bandOf(await design(page), 'Footer').elements[0]).toMatchObject({ type: 'text', isDynamic: true, dataSource: 'Company.Name' });
  });

  test('numbers are right-aligned and formatted, dates get a pattern', async ({ page }) => {
    await fieldItem(page, 'Genel toplam').click();
    await fieldItem(page, 'Belge tarihi').click();
    await fieldItem(page, 'Vade tarihi').click();
    await expect(elementsOn(page, 'Header')).toHaveText([/2\.845,52/, /13\.11\.2026 14:37/, /13\.12\.2026/]);
    const [total, date, due] = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements.length === 3), 'Header').elements;
    expect(total).toMatchObject({ align: 'right', format: 'N2' });
    expect(date.format).toBe('dd.MM.yyyy HH:mm');
    expect(due.format).toBe('dd.MM.yyyy');
    const zpl = await templateZpl(page);
    expect(zpl).toContain('{{Totals.Grand|fmt=N2}}');
    expect(zpl).toContain('{{Document.Date|fmt=dd.MM.yyyy HH:mm}}');
  });

  test('clicked fields line up below each other, numbers on the right', async ({ page }) => {
    for (const label of ['Firma adı', 'Belge no', 'Genel toplam']) await fieldItem(page, label).click();
    const [name, number, total] = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements.length === 3), 'Header').elements;
    expect([name.x, name.y]).toEqual([2, 1]);
    expect(number.x).toBe(2);
    expect(number.y).toBeGreaterThanOrEqual(name.y + name.height);
    expect(total.y).toBeGreaterThanOrEqual(number.y + number.height);
    // 72 mm page, 30 mm box, 2 mm margin.
    expect(total.x).toBe(40);
  });

  test('item fields go to the band that repeats their array', async ({ page }) => {
    // The header is selected, but item fields can only print in the Lines band.
    await bandLabel(page, 'Header').click();
    await fieldItem(page, 'Ürün adı').click();
    await fieldItem(page, 'Miktar').click();
    await expect(elementsOn(page, 'Lines')).toHaveText([/Süt 1L/, /^10$/]);
    await expect(elementsOn(page, 'Header')).toHaveCount(0);
    const [name, qty] = bandOf(await designWhere(page, t => bandOf(t, 'Lines').elements.length === 2), 'Lines').elements;
    expect(name.dataSource).toBe('Product.Name');
    // Whole sample values print without decimals.
    expect(qty).toMatchObject({ dataSource: 'Quantity', format: 'N0' });

    // A document field in a repeating band is reached from the root.
    await bandLabel(page, 'Lines').click();
    await fieldItem(page, 'Belge no').click();
    await designWhere(page, t => bandOf(t, 'Lines').elements[2]?.dataSource === '$.Document.Number');
  });

  test('item fields of an array without a band explain what to do', async ({ page }) => {
    await fieldItem(page, 'Oran').click();
    await expect(toolsPanel(page).getByRole('status')).toContainText('band that repeats KDV dökümü');
    await page.waitForTimeout(600);
    expect((await design(page).catch(() => null))).toBeNull();

    // Once a band repeats the array, the same click works.
    await bandLabel(page, 'Footer').click();
    await field(page, 'Repeat').selectOption('VatBreakdown');
    await fieldItem(page, 'Oran').click();
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
    await expect(toolsPanel(page).getByRole('status')).toHaveCount(0);
  });

  test('fields are added with the keyboard', async ({ page }) => {
    await fieldItem(page, 'Firma telefonu').focus();
    await page.keyboard.press('Enter');
    await expect(elementsOn(page, 'Header')).toHaveCount(1);
    await expect(elementsOn(page, 'Header').first()).toContainText('0216 000 00 00');
  });

  test('a field dragged onto a band lands where it is dropped', async ({ page }) => {
    const to = await center(page, 'Footer');
    await drag(page, fieldItem(page, 'Müşteri adı'), to);
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
    await expect(elementsOn(page, 'Footer').first()).toContainText('Deniz Market');
    const el = bandOf(await design(page), 'Footer').elements[0];
    expect(el.dataSource).toBe('Customer.Name');
    expect(el.y).toBeGreaterThan(5);
  });

  test('an item field is not dropped on a band that cannot print it', async ({ page }) => {
    await drag(page, fieldItem(page, 'Ürün adı'), await center(page, 'Header'));
    await expect(elementsOn(page, 'Header')).toHaveCount(0);
    await drag(page, fieldItem(page, 'Ürün adı'), await center(page, 'Lines'));
    await expect(elementsOn(page, 'Lines')).toHaveCount(1);
  });

  test('while an item field is dragged only its band lights up', async ({ page }) => {
    const item = fieldItem(page, 'Ürün adı');
    await item.scrollIntoViewIfNeeded();
    const box = (await item.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 6);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 16, { steps: 4 });
    const header = await center(page, 'Header');
    await page.mouse.move(header.x, header.y, { steps: 10 });
    await expect(band(page, 'Header')).not.toHaveClass(/bg-blue-50/);
    const lines = await center(page, 'Lines');
    await page.mouse.move(lines.x, lines.y, { steps: 10 });
    await expect(band(page, 'Lines')).toHaveClass(/bg-blue-50/);
    await page.mouse.up();
  });

  test('the karekod field shows where it will land while dragged', async ({ page }) => {
    const item = fieldItem(page, 'Karekod içeriği (GİB JSON)');
    await item.scrollIntoViewIfNeeded();
    const box = (await item.boundingBox())!;
    const footer = (await band(page, 'Footer').boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 6);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 16, { steps: 4 });
    // Dragged over the bottom-left of the footer, the outline is in its top-right corner.
    await page.mouse.move(footer.x + 30, footer.y + footer.height - 20, { steps: 10 });
    // The band under the pointer is known from the next move on.
    await page.mouse.move(footer.x + 34, footer.y + footer.height - 22);
    await expect(page.getByText('47.5, 1.0 mm')).toBeVisible();
    await page.mouse.up();
    const qr = bandOf(await designWhere(page, t => bandOf(t, 'Footer').elements.length === 1), 'Footer').elements[0];
    expect([qr.x, qr.y]).toEqual([47.5, 1]);
  });

  test('the logo field becomes a dynamic image and the karekod field a GİB QR', async ({ page }) => {
    await fieldItem(page, 'Firma logosu').click();
    await fieldItem(page, 'Karekod içeriği (GİB JSON)').click();
    const [logo, qr] = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements.length === 2), 'Header').elements;
    expect(logo).toMatchObject({ type: 'image', imageKey: 'Company.Logo' });
    expect(qr).toMatchObject({ type: 'barcode', barcodeType: 'qr', dataSource: 'Document.QrContent', magnification: 2, y: 1 });
    expect(qr.x + qr.width).toBeCloseTo(70, 1);
    await expect(propertiesPanel(page).getByText('Choose the catalog field that holds the karekod JSON above.')).toHaveCount(0);
    const zpl = await templateZpl(page);
    expect(zpl).toContain('^FX ZC:IMAGE key=Company.Logo');
    expect(zpl).toContain('{{Document.QrContent}}');
  });

  test('the list follows the catalog', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser');
    await (await catalogAction(page, 'From sample JSON')).click();
    await (await chooser).setFiles({ name: 'adisyon.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ Table: 'A4', Items: [{ Name: 'Çay', Qty: 2 }] })) });
    await expect(list(page).getByRole('button')).toHaveText([/^Table/, /^Name/, /^Qty/]);
    await expect(list(page).getByRole('region', { name: 'Items' })).toBeVisible();
  });
});
