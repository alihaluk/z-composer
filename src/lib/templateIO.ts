// Loading, validating and migrating template files.
import { type Catalog } from './catalog';
import { fieldsUsed, isValidPath } from './catalogIO';
import { DPI_OPTIONS, roundMm } from './constants';
import { type Band, type ElementType, type Template, type TemplateElement } from '../types';

export const newId = (prefix = 'e') => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

export interface BandNames {
  header: string;
  lines: string;
  footer: string;
}

export const ENGLISH_BAND_NAMES: BandNames = { header: 'Header', lines: 'Lines', footer: 'Footer' };

export function emptyTemplate(names: BandNames = ENGLISH_BAND_NAMES): Template {
  return {
    schemaVersion: 2,
    printer: { widthMm: 72, dpi: 203 },
    bands: [
      { id: newId('b'), name: names.header, height: 30, elements: [] },
      { id: newId('b'), name: names.lines, repeat: 'Lines', height: 8, elements: [] },
      { id: newId('b'), name: names.footer, height: 30, elements: [] },
    ],
  };
}

const ELEMENT_TYPES: ElementType[] = ['text', 'box', 'barcode', 'image'];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function fail(message: string): never {
  throw new Error(`Invalid template: ${message}`);
}

/** A format is written inside a placeholder, so it cannot contain `|`, `}` or line breaks. */
export const isValidFormat = (format: unknown) => typeof format === 'string' && format.length > 0 && !/[|}\r\n]/.test(format);

// Paths end up in placeholders and markers (docs/OUTPUT_SPEC.md sections 4 and 5).
function checkPath(path: unknown, where: string) {
  if (path !== undefined && path !== '' && (typeof path !== 'string' || !isValidPath(path))) fail(`${where}: invalid field path ${JSON.stringify(path)}`);
}

function checkParts(parts: unknown, where: string) {
  if (!Array.isArray(parts)) fail(`${where}: parts must be an array`);
  parts.forEach((p, k) => {
    const at = `${where} part ${k}`;
    if (isObject(p) && typeof p.text === 'string' && p.path === undefined) return;
    // An empty path is a field part whose field is not chosen yet; it is left out of the output.
    if (!isObject(p) || typeof p.path !== 'string' || (p.path !== '' && !isValidPath(p.path))) fail(`${at}: needs static text or a valid field path`);
    if (p.format !== undefined && !isValidFormat(p.format)) fail(`${at}: invalid format`);
    if (p.max !== undefined && !(Number.isInteger(p.max) && (p.max as number) > 0)) fail(`${at}: max must be a positive whole number`);
  });
}

function checkCondition(condition: unknown, where: string) {
  if (condition === undefined) return;
  if (!isObject(condition) || !['notEmpty', 'notZero'].includes(condition.op as string)) fail(`${where}: invalid condition`);
  checkPath(condition.path, `${where} condition`);
}

function validateV2(t: Record<string, unknown>): Template {
  const printer = t.printer;
  if (!isObject(printer) || !isNumber(printer.widthMm) || printer.widthMm <= 0) fail('printer.widthMm must be a positive number');
  if (!DPI_OPTIONS.includes(printer.dpi as never)) fail(`printer.dpi must be one of ${DPI_OPTIONS.join(', ')}`);
  if (!Array.isArray(t.bands)) fail('bands must be an array');
  const bands = t.bands.map((b, i): Band => {
    if (!isObject(b) || typeof b.id !== 'string' || !isNumber(b.height) || b.height <= 0 || !Array.isArray(b.elements)) fail(`band ${i} needs id, a positive height and elements`);
    checkPath(b.repeat, `band ${i} repeat`);
    checkCondition(b.condition, `band ${i}`);
    const elements = b.elements.map((e, j): TemplateElement => {
      const where = `element ${j} of band ${i}`;
      if (!isObject(e) || typeof e.id !== 'string' || !ELEMENT_TYPES.includes(e.type as ElementType)) fail(`${where} needs an id and a known type`);
      for (const key of ['x', 'y', 'width', 'height']) if (!isNumber(e[key])) fail(`${where}: ${key} must be a number`);
      checkPath(e.dataSource, `${where} dataSource`);
      if (e.parts !== undefined) checkParts(e.parts, where);
      checkPath(e.imageKey, `${where} imageKey`);
      checkCondition(e.condition, where);
      if (e.format !== undefined && !isValidFormat(e.format)) fail(`${where}: invalid format`);
      return e as unknown as TemplateElement;
    });
    return { ...(b as unknown as Band), name: typeof b.name === 'string' ? b.name : `Band ${i + 1}`, elements };
  });
  return { ...(t as unknown as Template), printer: printer as unknown as Template['printer'], bands };
}

// ---- v1 (header / body / footer, canvas pixels) ----

const V1_PX_PER_MM = 3.78;
/** v1 font sizes were points converted with 203 / 72 dots per point at 8 dots/mm. */
const V1_PT_TO_MM = 203 / 72 / 8;
const V1_ROW_FIELDS = new Set(['LineNumber', 'Quantity', 'UnitMultiplier', 'Product.Name', 'Product.Sku', 'Product.Vat', 'Product.Group.Name',
  'Product.Brand.Name', 'Price', 'UnitName', 'Unit.Name', 'VatPercent', 'VatTotal', 'Amount', 'Discount', 'DiscountPercent', 'VatIncludeTotal',
  'Total', 'NetTotal', 'DiscountIndex', 'UnitWeight', 'Barcode']);

interface V1Element {
  id: string; type: ElementType; x: number; y: number; width?: number; height?: number;
  content?: string; isDynamic?: boolean; dataSource?: string; imageKey?: string; fontSize?: number; fontBold?: boolean;
  rotation?: 0 | 90 | 180 | 270; maxChars?: number; barcodeType?: 'code128' | 'qr'; showLabel?: boolean; imageBase64?: string;
}
interface V1Section { height: number; elements: V1Element[] }

function migrateElement(el: V1Element, inBody: boolean): TemplateElement {
  const mm = (px: number | undefined, fallback: number) => roundMm((px ?? fallback) / V1_PX_PER_MM);
  let dataSource = el.dataSource;
  if (inBody && dataSource && !V1_ROW_FIELDS.has(dataSource)) dataSource = `$.${dataSource}`;
  const migrated: TemplateElement = {
    id: el.id, type: el.type, x: mm(el.x, 0), y: mm(el.y, 0), width: mm(el.width, 100), height: mm(el.height, 50),
    isDynamic: el.isDynamic, content: el.content, dataSource, fontBold: el.fontBold, rotation: el.rotation,
  };
  if (el.type === 'text') {
    migrated.fontSize = roundMm((el.fontSize ?? 12) * V1_PT_TO_MM);
    if (el.maxChars) Object.assign(migrated, { overflow: 'truncate', maxChars: el.maxChars });
  }
  if (el.type === 'box') migrated.thickness = 0.25;
  if (el.type === 'barcode') {
    migrated.barcodeType = el.barcodeType ?? 'code128';
    migrated.showLabel = el.showLabel;
    if (migrated.barcodeType === 'qr') migrated.magnification = Math.max(1, Math.min(10, Math.round((el.width ?? 50) / 25)));
    else migrated.moduleWidth = 2;
  }
  if (el.type === 'image') Object.assign(migrated, { imageKey: el.imageKey, imageBase64: el.imageBase64 });
  return migrated;
}

export function migrateV1(t: { header: V1Section; body: V1Section; footer: V1Section; canvasWidth?: number }): Template {
  const band = (name: string, s: V1Section, repeat?: string): Band => ({
    id: newId('b'), name, repeat, height: s.height, elements: s.elements.map(el => migrateElement(el, !!repeat)),
  });
  return {
    schemaVersion: 2,
    printer: { widthMm: t.canvasWidth ?? 104, dpi: 203 },
    bands: [band('Header', t.header), band('Lines', t.body, 'Lines'), band('Footer', t.footer)],
  };
}

/** The template as it is saved: with the snapshot of the catalog fields it uses (docs/SCOPE.md D2). */
export const withFieldsUsed = (template: Template, catalog: Catalog): Template => ({ ...template, fieldsUsed: fieldsUsed(template, catalog) });

/** Accepts a parsed JSON template of any supported version and returns a v2 template. */
export function parseTemplate(json: unknown): Template {
  if (!isObject(json)) fail('not an object');
  if (json.schemaVersion === 2) return validateV2(json);
  if (isObject(json.header) && isObject(json.body) && isObject(json.footer)) {
    return validateV2(migrateV1(json as unknown as Parameters<typeof migrateV1>[0]) as unknown as Record<string, unknown>);
  }
  if (isNumber(json.schemaVersion) && json.schemaVersion > 2) fail(`schema version ${json.schemaVersion} is newer than this designer supports`);
  return fail('unknown format');
}
