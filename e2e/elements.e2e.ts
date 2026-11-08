import { expect, test } from '@playwright/test';
import { band, bandOf, deselect, design, designWhere, drag, elementsOn, field, fill, open, propertiesPanel, templateZpl, tool } from './helpers';

test.describe('elements', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('every tool adds its element to the first band', async ({ page }) => {
    for (const name of ['Text', 'Box', 'Line', 'Barcode', 'QR code', 'Image']) await tool(page, name).click();
    await expect(elementsOn(page, 'Header')).toHaveCount(6);
    const header = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements.length === 6), 'Header');
    expect(header.elements.map(e => e.type === 'barcode' ? e.barcodeType : e.type)).toEqual(['text', 'box', 'box', 'code128', 'qr', 'image']);

    const zpl = await templateZpl(page);
    expect(zpl).toContain('^FDText^FS');
    expect(zpl).toContain('^BC');
    expect(zpl).toContain('^BQ');
  });

  test('a tool adds to the selected band and with the keyboard', async ({ page }) => {
    await band(page, 'Footer').click({ position: { x: 200, y: 60 } });
    await expect(propertiesPanel(page).getByRole('heading', { name: 'Band', exact: true }).first()).toBeVisible();
    await tool(page, 'Box').focus();
    await page.keyboard.press('Enter');
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
    await expect(elementsOn(page, 'Header')).toHaveCount(0);
  });

  test('dragging a tool drops it where it is released', async ({ page }) => {
    const footer = (await band(page, 'Footer').boundingBox())!;
    await drag(page, tool(page, 'Box'), { x: footer.x + footer.width / 2, y: footer.y + footer.height / 2 });
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
    const box = bandOf(await design(page), 'Footer').elements[0];
    expect(box.x).toBeGreaterThan(10);
    expect(box.y).toBeGreaterThan(5);
  });

  test('properties edit a text element and the ZPL follows', async ({ page }) => {
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await expect(propertiesPanel(page).getByRole('heading', { name: 'Text', exact: true }).first()).toBeVisible();

    await fill(field(page, 'X (mm)'), '10');
    await fill(field(page, 'Y (mm)'), '4');
    await fill(propertiesPanel(page).getByRole('textbox').first(), 'Merhaba Dünya');
    await propertiesPanel(page).getByRole('radio', { name: 'Center' }).click();
    await field(page, 'Bold').check();

    await expect(elementsOn(page, 'Header').first()).toContainText('Merhaba Dünya');
    const el = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements[0]?.content === 'Merhaba Dünya'), 'Header').elements[0];
    expect(el).toMatchObject({ x: 10, y: 4, align: 'center', fontBold: true });
    // Element ZPL: ^FO at 10 mm / 4 mm in 203 dpi dots, ^FB for the alignment.
    const elementZpl = await propertiesPanel(page).locator('pre').textContent();
    expect(elementZpl).toMatch(/\^FO80,32/);
    expect(elementZpl).toContain('Merhaba Dünya');
  });

  test('keyboard moves, duplicates and deletes the selection', async ({ page }) => {
    await tool(page, 'Box').click();
    const box = elementsOn(page, 'Header').first();
    await box.click();
    const start = bandOf(await design(page), 'Header').elements[0];

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await designWhere(page, t => {
      const el = bandOf(t, 'Header').elements[0];
      return el.x === start.x + 0.5 && el.y === start.y + 5;
    });

    await page.keyboard.press('ControlOrMeta+d');
    await expect(elementsOn(page, 'Header')).toHaveCount(2);
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(elementsOn(page, 'Header')).toHaveCount(3);

    await page.keyboard.press('Delete');
    await expect(elementsOn(page, 'Header')).toHaveCount(2);
  });

  test('undo and redo with buttons and shortcuts', async ({ page }) => {
    const undo = page.getByRole('button', { name: /^Undo/ });
    const redo = page.getByRole('button', { name: /^Redo/ });
    await expect(undo).toBeDisabled();
    await tool(page, 'Text').click();
    await tool(page, 'Box').click();
    await expect(elementsOn(page, 'Header')).toHaveCount(2);

    await undo.click();
    await expect(elementsOn(page, 'Header')).toHaveCount(1);
    await redo.click();
    await expect(elementsOn(page, 'Header')).toHaveCount(2);

    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(elementsOn(page, 'Header')).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(elementsOn(page, 'Header')).toHaveCount(1);
  });

  test('dragging an element moves it, also to another band', async ({ page }) => {
    await tool(page, 'Box').click();
    const box = elementsOn(page, 'Header').first();
    const start = bandOf(await design(page), 'Header').elements[0];
    const b = (await box.boundingBox())!;
    await drag(page, box, { x: b.x + 10 + 60, y: b.y + 6 + 20 });
    const moved = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements[0]?.x !== start.x), 'Header').elements[0];
    expect(moved.x).toBeGreaterThan(start.x + 5);
    expect(moved.y).toBeGreaterThan(start.y);

    const footer = (await band(page, 'Footer').boundingBox())!;
    await drag(page, box, { x: footer.x + 80, y: footer.y + 30 });
    await expect(elementsOn(page, 'Footer')).toHaveCount(1);
    await expect(elementsOn(page, 'Header')).toHaveCount(0);
  });

  test('the resize handle changes the size', async ({ page }) => {
    await tool(page, 'Box').click();
    const box = elementsOn(page, 'Header').first();
    await box.click();
    const start = bandOf(await design(page), 'Header').elements[0];
    const handle = box.locator('[role=presentation]');
    const h = (await handle.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 60, h.y + 30, { steps: 8 });
    await page.mouse.up();
    const resized = bandOf(await designWhere(page, t => bandOf(t, 'Header').elements[0]?.width !== start.width), 'Header').elements[0];
    expect(resized.width).toBeGreaterThan(start.width);
    expect(resized.height).toBeGreaterThan(start.height);
  });

  test('a locked element ignores the keyboard and cannot be deleted', async ({ page }) => {
    await tool(page, 'Box').click();
    await elementsOn(page, 'Header').first().click();
    await field(page, 'Locked').check();
    await expect(field(page, 'X (mm)')).toBeDisabled();
    await expect(propertiesPanel(page).getByRole('button', { name: 'Delete' })).toBeDisabled();
    const before = bandOf(await designWhere(page, t => !!bandOf(t, 'Header').elements[0]?.locked), 'Header').elements[0];
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(700);
    const after = bandOf(await design(page), 'Header').elements;
    expect(after).toHaveLength(1);
    expect(after[0].x).toBe(before.x);
  });

  test('bring to front and send to back reorder the band', async ({ page }) => {
    await tool(page, 'Text').click();
    await tool(page, 'Box').click();
    await elementsOn(page, 'Header').first().click();
    await propertiesPanel(page).getByRole('button', { name: 'Bring to front' }).click();
    const types = (await designWhere(page, t => bandOf(t, 'Header').elements[1]?.type === 'text')).bands[0].elements.map(e => e.type);
    expect(types).toEqual(['box', 'text']);
    await propertiesPanel(page).getByRole('button', { name: 'Send to back' }).click();
    await designWhere(page, t => bandOf(t, 'Header').elements[0]?.type === 'text');
  });

  test('a wrapping text grows its band with sample data', async ({ page }) => {
    await tool(page, 'Text').click();
    await elementsOn(page, 'Header').first().click();
    await propertiesPanel(page).getByRole('radio', { name: 'Field' }).click();
    // The first "Field" select binds the content; the second one is the condition.
    await field(page, 'Field').first().selectOption('Company.Address');
    await fill(field(page, 'Width (mm)'), '20');
    await field(page, 'Overflow').selectOption('wrap');
    await field(page, 'Band grows with the text').check();
    await deselect(page);

    const header = band(page, 'Header');
    const settings = propertiesPanel(page).getByRole('radiogroup', { name: 'Canvas shows' });
    await settings.getByRole('radio', { name: 'Field names' }).click();
    const plain = (await header.boundingBox())!.height;
    await settings.getByRole('radio', { name: 'Sample data' }).click();
    await expect(elementsOn(page, 'Header').first()).toContainText('Atatürk');
    await expect.poll(async () => (await header.boundingBox())!.height).toBeGreaterThan(plain);
    expect(await templateZpl(page)).toContain('^FX ZC:GROW');
  });

  test('elements are selected and moved with the keyboard alone', async ({ page }) => {
    await tool(page, 'Text').click();
    await tool(page, 'Box').click();
    await page.keyboard.press('Escape');
    const [text, box] = [elementsOn(page, 'Header').nth(0), elementsOn(page, 'Header').nth(1)];
    await text.focus();
    await page.keyboard.press('Enter');
    await expect(propertiesPanel(page).getByRole('heading', { name: 'Text', exact: true }).first()).toBeVisible();
    await box.focus();
    await page.keyboard.press('Shift+Space');
    await expect(propertiesPanel(page).getByRole('heading', { name: '2 elements selected' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    const t = await designWhere(page, d => bandOf(d, 'Header').elements.every(e => e.y > 1));
    expect(bandOf(t, 'Header').elements.map(e => e.y)).toEqual([1.5, 3.5]);
  });

  test('a band takes one growing text', async ({ page }) => {
    for (let i = 0; i < 2; i++) await tool(page, 'Text').click();
    await elementsOn(page, 'Header').nth(0).click();
    await field(page, 'Overflow').selectOption('wrap');
    await field(page, 'Band grows with the text').check();
    await elementsOn(page, 'Header').nth(1).click();
    await field(page, 'Overflow').selectOption('wrap');
    await expect(field(page, 'Band grows with the text')).toBeDisabled();
    await expect(propertiesPanel(page).getByText('Another text in this band already grows')).toBeVisible();

    // A copy of the growing text is reported, and only the first one grows in the output.
    await elementsOn(page, 'Header').nth(0).click();
    await page.keyboard.press('ControlOrMeta+d');
    await expect(propertiesPanel(page).getByRole('list', { name: 'Design check' })).toContainText('Another text in this band already grows');
    expect((await templateZpl(page)).match(/ZC:GROW/g)).toHaveLength(1);
  });
});

