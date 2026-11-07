import { expect, test } from '@playwright/test';
import { band, bandOf, designWhere, elementsOn, field, fill, open, propertiesPanel, tool } from './helpers';

test.describe('selection', () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    // Two boxes in the header, one in the footer.
    await tool(page, 'Box').click();
    await tool(page, 'Box').click();
    // Apart from the first one, so neither covers the other.
    await elementsOn(page, 'Header').nth(1).click();
    await fill(field(page, 'X (mm)'), '40');
    await fill(field(page, 'Y (mm)'), '12');
    await band(page, 'Footer').click({ position: { x: 300, y: 100 } });
    await tool(page, 'Box').click();
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
  });

  test('shift click selects across bands and moves them together', async ({ page }) => {
    await elementsOn(page, 'Header').nth(0).click();
    await elementsOn(page, 'Header').nth(1).click({ modifiers: ['Shift'] });
    await elementsOn(page, 'Footer').nth(0).click({ modifiers: ['Shift'] });
    await expect(propertiesPanel(page).getByRole('heading', { name: '3 elements selected' })).toBeVisible();
    // Top edges of different bands are not comparable.
    await expect(propertiesPanel(page).getByRole('button', { name: 'Top edges', exact: true })).toHaveCount(0);
    await expect(propertiesPanel(page).getByTitle('Aligning top edges needs elements of one band')).toBeDisabled();

    await page.keyboard.press('Shift+ArrowRight');
    const t = await designWhere(page, d => bandOf(d, 'Footer').elements[0]?.x >= 7);
    expect(bandOf(t, 'Header').elements.map(e => e.x)).toEqual([7, 45]);
    expect(bandOf(t, 'Footer').elements[0].x).toBe(7);

    // Shift click on a selected element takes it out again.
    await elementsOn(page, 'Footer').nth(0).click({ modifiers: ['Shift'] });
    await expect(propertiesPanel(page).getByRole('heading', { name: '2 elements selected' })).toBeVisible();
  });

  test('a rectangle selects the elements it touches, shift adds from another band', async ({ page }) => {
    const header = (await band(page, 'Header').boundingBox())!;
    await page.mouse.move(header.x + 2, header.y + 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width - 4, header.y + header.height - 4, { steps: 6 });
    await page.mouse.up();
    await expect(propertiesPanel(page).getByRole('heading', { name: '2 elements selected' })).toBeVisible();

    const footer = (await band(page, 'Footer').boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(footer.x + 2, footer.y + 2);
    await page.mouse.down();
    await page.mouse.move(footer.x + footer.width - 4, footer.y + footer.height - 4, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(propertiesPanel(page).getByRole('heading', { name: '3 elements selected' })).toBeVisible();
  });

  test('align, duplicate and delete a selection', async ({ page }) => {
    await elementsOn(page, 'Header').nth(0).click();
    await elementsOn(page, 'Header').nth(1).click({ modifiers: ['Shift'] });
    await propertiesPanel(page).getByTitle('Top edges').click();
    await designWhere(page, d => { const [a, b] = bandOf(d, 'Header').elements; return a.y === b.y; });
    await propertiesPanel(page).getByTitle('Left edges').click();
    const t = await designWhere(page, d => { const [a, b] = bandOf(d, 'Header').elements; return a.x === b.x; });
    expect(bandOf(t, 'Header').elements[0].x).toBe(2);

    await propertiesPanel(page).getByRole('button', { name: 'Duplicate' }).click();
    await expect(elementsOn(page, 'Header')).toHaveCount(4);
    await propertiesPanel(page).getByRole('button', { name: 'Delete' }).click();
    await expect(elementsOn(page, 'Header')).toHaveCount(2);
  });

  test('Escape clears the selection', async ({ page }) => {
    await elementsOn(page, 'Header').nth(0).click();
    await expect(propertiesPanel(page).getByText('Position and size')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(propertiesPanel(page).getByText('Printable width (mm)')).toBeVisible();
  });

  test('Ctrl or Cmd + A selects every element of every band', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+a');
    await expect(propertiesPanel(page).getByRole('heading', { name: '3 elements selected' })).toBeVisible();
    // The selection moves together.
    await page.keyboard.press('ArrowDown');
    const t = await designWhere(page, d => bandOf(d, 'Footer').elements[0]?.y !== undefined && bandOf(d, 'Header').elements[0].y === 1.5);
    expect(bandOf(t, 'Header').elements.map(e => e.y)).toEqual([1.5, 12.5]);

    // In a text box it keeps selecting the text.
    const name = page.getByLabel('New template name');
    await name.fill('abc');
    await name.press('ControlOrMeta+a');
    expect(await name.evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 3]);
    await expect(propertiesPanel(page).getByRole('heading', { name: '3 elements selected' })).toBeVisible();
  });
});
