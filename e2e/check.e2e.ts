import { expect, test, type Page } from '@playwright/test';
import { band, bandLabel, bandOf, deselect, designWhere, drag, elementsOn, field, fill, loadPreset, open, propertiesPanel, tool, toolsPanel } from './helpers';

const checkList = (page: Page) => propertiesPanel(page).getByRole('list', { name: 'Design check' });
const counter = (page: Page) => page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: /^Design check: / });
const fieldItem = (page: Page, label: string) => toolsPanel(page).getByRole('region', { name: 'Fields' }).getByRole('button', { name: new RegExp(`^${label}`) });

test.describe('design check', () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await fill(field(page, 'Preview culture'), 'tr-TR');
  });

  test('the invoice preset has no problems', async ({ page }) => {
    await loadPreset(page);
    await deselect(page);
    await expect(propertiesPanel(page).getByText('No problems found')).toBeVisible();
    await expect(counter(page)).toHaveCount(0);
  });

  test('text past the paper is listed, outlined and located', async ({ page }) => {
    await fieldItem(page, 'Firma adresi').click();
    await fill(field(page, 'X (mm)'), '40');
    // The element's own panel says what is wrong.
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toContainText('The sample text does not fit');
    const el = elementsOn(page, 'Header').first();
    await expect(counter(page)).toHaveAccessibleName('Design check: 1');

    // Unselected, the element is outlined dashed in red.
    await counter(page).click();
    await expect(el).toHaveCSS('outline-style', 'dashed');
    await expect(el).toHaveClass(/outline-red-500/);
    await expect(checkList(page)).toContainText('Header · Text');
    await expect(checkList(page)).toContainText('“Atatürk Cad. No:1 Kadıköy / İstanbul”');
    await expect(propertiesPanel(page).getByText('Errors: 1, warnings: 0')).toBeVisible();

    // Clicking the finding selects the element; moving it back clears the finding.
    await checkList(page).getByRole('button').first().click();
    await expect(field(page, 'X (mm)')).toHaveValue('40');
    await fill(field(page, 'X (mm)'), '2');
    await expect(counter(page)).toHaveCount(0);
    await expect(el).toHaveCSS('outline-style', 'solid');
  });

  test('a document field moved into a repeating band is fixed with one click', async ({ page }) => {
    await fieldItem(page, 'Belge no').click();
    const lines = (await band(page, 'Lines').boundingBox())!;
    await drag(page, elementsOn(page, 'Header').first(), { x: lines.x + 60, y: lines.y + lines.height / 2 });
    await expect(elementsOn(page, 'Lines')).toHaveCount(1);
    await expect(counter(page)).toBeVisible();

    await elementsOn(page, 'Lines').first().click();
    const own = propertiesPanel(page).getByRole('list', { name: 'Design check' });
    await expect(own).toContainText('Document.Number is a document field; in a repeating band it is bound as $.Document.Number.');
    await own.getByRole('button', { name: 'Fix' }).click();
    await expect(own).toHaveCount(0);
    await designWhere(page, t => bandOf(t, 'Lines').elements[0]?.dataSource === '$.Document.Number');
    await expect(elementsOn(page, 'Lines').first()).toContainText('FTR2026000000123');
  });

  test('a barcode too wide for the paper is found once measured', async ({ page }) => {
    await tool(page, 'Barcode').click();
    await elementsOn(page, 'Header').first().click();
    await propertiesPanel(page).getByRole('radiogroup', { name: 'Content' }).getByRole('radio', { name: 'Static' }).click();
    await fill(propertiesPanel(page).getByRole('textbox').first(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    await fill(field(page, 'Bar width (dots)'), '3');
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toContainText('The barcode does not fit on the paper');
    await fill(field(page, 'Bar width (dots)'), '1');
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toHaveCount(0);
  });

  test('wrapped text with too few lines is a warning', async ({ page }) => {
    await fieldItem(page, 'Firma adresi').click();
    await fill(field(page, 'Width (mm)'), '20');
    await field(page, 'Overflow').selectOption('wrap');
    await fill(field(page, 'Maximum lines'), '1');
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toContainText('needs 3 lines; only 1 are printed');
    await expect(counter(page)).toHaveClass(/text-amber-700/);
    await fill(field(page, 'Maximum lines'), '3');
    await expect(counter(page)).toHaveCount(0);
  });

  test('a catalog without the band\'s array is reported on the band', async ({ page }) => {
    await bandLabel(page, 'Footer').click();
    await field(page, 'Repeat').selectOption('VatBreakdown');
    // A text bound to a field the catalog loses.
    await fieldItem(page, 'Oran').click();
    const chooser = page.waitForEvent('filechooser');
    await toolsPanel(page).getByRole('button', { name: 'From sample JSON' }).click();
    await (await chooser).setFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"Lines":[{"X":1}]}') });
    await bandLabel(page, 'Footer').click();
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toContainText('VatBreakdown is not in the catalog');
    await deselect(page);
    await expect(checkList(page)).toContainText('Footer · band');
    await expect(checkList(page)).toContainText('Rate is not in the catalog');
  });

  test('Turkish messages use a decimal comma', async ({ page }) => {
    await toolsPanel(page).getByRole('group', { name: 'Language' }).getByRole('button', { name: 'tr' }).click();
    await toolsPanel(page).getByRole('region', { name: 'Alanlar' }).getByRole('button', { name: /^Firma adresi/ }).click();
    await fill(propertiesPanel(page).getByLabel('X (mm)', { exact: true }), '40');
    await expect(propertiesPanel(page).getByRole('list', { name: 'Tasarım kontrolü' })).toContainText(/Örnek metin sığmıyor: \d+,\d mm genişlik, 32 mm yer var/);
  });
});
