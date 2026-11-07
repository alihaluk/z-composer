import { expect, type Locator, type Page } from '@playwright/test';

export const STORAGE_KEY = 'zcomposer_templates_v2';

export interface Element {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  dataSource?: string;
  format?: string;
  parts?: unknown[];
  barcodeType?: string;
  locked?: boolean;
  [key: string]: unknown;
}

export interface Band {
  id: string;
  name: string;
  height: number;
  repeat?: string;
  condition?: { path: string; op: string };
  elements: Element[];
}

export interface Template {
  printer: { widthMm: number; dpi: number };
  bands: Band[];
}

/** Opens the designer in English with empty storage (every test gets a fresh browser context). */
export async function open(page: Page) {
  await page.goto('./?lng=en');
  await expect(page.getByRole('heading', { name: 'Toolbox' })).toBeVisible();
}

export const toolsPanel = (page: Page) => page.locator('aside').first();
export const propertiesPanel = (page: Page) => page.locator('aside').last();

/** A tool of the toolbox; click adds it to the selected band. */
export const tool = (page: Page, name: string) => toolsPanel(page).getByRole('button', { name, exact: true });

/** The drawing area of a band. */
export const band = (page: Page, name: string) => page.getByLabel(`${name} band`, { exact: true });

/** The label button beside a band, which selects it. */
export const bandLabel = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name} · `) });

/** Elements drawn on a band, in drawing order. */
export const elementsOn = (page: Page, bandName: string) => band(page, bandName).getByRole('button');

/** A labelled input of the properties panel. */
export const field = (page: Page, label: string) => propertiesPanel(page).getByLabel(label, { exact: true });

/** Sets a number or text input as a user would: focus, replace, leave. */
export async function fill(input: Locator, value: string) {
  await input.click();
  await input.fill(value);
  await input.blur();
}

/** The design as the app keeps it: the draft it stores half a second after every change. */
export async function design(page: Page): Promise<Template> {
  let template: Template | undefined;
  await expect.poll(async () => {
    const raw = await page.evaluate(key => localStorage.getItem(`${key}_draft`), STORAGE_KEY);
    template = raw ? (JSON.parse(raw) as { template: Template }).template : undefined;
    return template !== undefined;
  }).toBe(true);
  return template!;
}

/** Waits until the stored draft passes `check`, then returns it. */
export async function designWhere(page: Page, check: (t: Template) => boolean): Promise<Template> {
  let template: Template | undefined;
  await expect.poll(async () => {
    const raw = await page.evaluate(key => localStorage.getItem(`${key}_draft`), STORAGE_KEY);
    template = raw ? (JSON.parse(raw) as { template: Template }).template : undefined;
    return !!template && check(template);
  }, { timeout: 5000 }).toBe(true);
  return template!;
}

export const bandOf = (t: Template, name: string) => {
  const b = t.bands.find(x => x.name === name);
  if (!b) throw new Error(`No band "${name}"`);
  return b;
};

/** Clears the selection by clicking an empty spot of the canvas. */
export async function deselect(page: Page) {
  await page.locator('main').click({ position: { x: 40, y: 400 } });
  await expect(propertiesPanel(page).getByText('Printable width (mm)')).toBeVisible();
}

/** The template ZPL shown in the properties panel when nothing is selected. */
export async function templateZpl(page: Page): Promise<string> {
  await deselect(page);
  const pre = propertiesPanel(page).locator('pre').last();
  await expect(pre).toBeVisible();
  return (await pre.textContent()) ?? '';
}

/** Answers the next window.confirm. */
export function acceptConfirm(page: Page, expected?: RegExp) {
  page.once('dialog', async dialog => {
    if (expected) expect(dialog.message()).toMatch(expected);
    await dialog.accept();
  });
}

/** Loads a ready-made template from the sidebar's picker (the e-Fatura by default). */
export async function loadPreset(page: Page, name = 'e-Fatura') {
  await toolsPanel(page).getByRole('button', { name: 'Ready-made templates…' }).click();
  await page.getByRole('dialog', { name: 'Ready-made templates' }).getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }).click();
  await expect(page.getByRole('dialog', { name: 'Ready-made templates' })).toHaveCount(0);
  if (name === 'e-Fatura') await expect(band(page, 'Totals')).toBeVisible();
}

/** Drags with real mouse steps, as dnd-kit needs. */
export async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  await from.scrollIntoViewIfNeeded();
  const box = await from.boundingBox();
  if (!box) throw new Error('Drag source is not visible');
  const start = { x: box.x + Math.min(10, box.width / 2), y: box.y + Math.min(6, box.height / 2) };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
