import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, type Catalog } from './catalog';
import { bandForField, bindingPath, createFieldElement, fieldRefs, matchesField, nextFieldPosition, searchFold, type FieldRef } from './fieldElements';
import { GIB_QR_FIELD } from './gibQr';
import { generateTemplateZpl } from './zplTemplate';
import { type Band } from '../types';

const header: Band = { id: 'h', name: 'Header', height: 30, elements: [] };
const lines: Band = { id: 'l', name: 'Lines', height: 8, repeat: 'Lines', elements: [] };
const vat: Band = { id: 'v', name: 'VAT', height: 5, repeat: 'VatBreakdown', elements: [] };
const ref = (path: string, array?: string): FieldRef => fieldRefs(DEFAULT_CATALOG).find(r => r.path === path && r.array === array)!;

describe('fieldRefs', () => {
  it('lists document fields, then the item fields of each array', () => {
    const refs = fieldRefs(DEFAULT_CATALOG);
    expect(refs[0].path).toBe('Company.Name');
    expect(refs[0].array).toBeUndefined();
    expect(refs.some(r => r.field.type === 'array')).toBe(false);
    expect(refs.find(r => r.path === 'Product.Name')?.array).toBe('Lines');
    expect(refs.find(r => r.path === 'Rate')?.array).toBe('VatBreakdown');
  });
});

describe('bindingPath', () => {
  it('binds document fields directly, and from the root inside a repeating band', () => {
    expect(bindingPath(ref('Document.Number'), header)).toBe('Document.Number');
    expect(bindingPath(ref('Document.Number'), lines)).toBe('$.Document.Number');
  });

  it('binds item fields only in a band that repeats their array', () => {
    expect(bindingPath(ref('Product.Name', 'Lines'), lines)).toBe('Product.Name');
    expect(bindingPath(ref('Product.Name', 'Lines'), header)).toBeNull();
    expect(bindingPath(ref('Product.Name', 'Lines'), vat)).toBeNull();
  });
});

describe('bandForField', () => {
  const bands = [header, lines, vat];
  it('prefers the selected band', () => {
    expect(bandForField(ref('Document.Number'), bands, 'v')).toBe(vat);
  });
  it('falls back to the first band that can print the field', () => {
    expect(bandForField(ref('Rate', 'VatBreakdown'), bands, 'h')).toBe(vat);
    expect(bandForField(ref('Document.Number'), bands, undefined)).toBe(header);
    expect(bandForField(ref('Rate', 'VatBreakdown'), [header], 'h')).toBeUndefined();
  });
});

describe('createFieldElement', () => {
  const make = (r: FieldRef, band: Band = header, catalog: Catalog = DEFAULT_CATALOG) => createFieldElement(r, band, 5, 2, catalog, 72);

  it('makes a text element bound to a string field', () => {
    const el = make(ref('Company.Name'))!;
    expect(el).toMatchObject({ type: 'text', x: 5, y: 2, isDynamic: true, dataSource: 'Company.Name' });
    expect(el.content).toBeUndefined();
    expect(el.format).toBeUndefined();
  });

  it('right-aligns numbers, with decimals unless the sample value is whole', () => {
    expect(make(ref('Totals.Grand'))).toMatchObject({ align: 'right', format: 'N2' });
    expect(make(ref('Quantity', 'Lines'), lines)).toMatchObject({ dataSource: 'Quantity', align: 'right', format: 'N0' });
    expect(make(ref('Price', 'Lines'), lines)).toMatchObject({ format: 'N2' });
    // Without a sample value decimals are kept.
    expect(make(ref('Totals.Grand'), header, { ...DEFAULT_CATALOG, sample: undefined })).toMatchObject({ format: 'N2' });
  });

  it('gives dates a fixed pattern', () => {
    expect(make(ref('Document.DueDate'))?.format).toBe('dd.MM.yyyy');
    expect(make(ref('Document.Date'))?.format).toBe('dd.MM.yyyy HH:mm');
  });

  it('makes image fields dynamic images', () => {
    expect(make(ref('Company.Logo'))).toMatchObject({ type: 'image', imageKey: 'Company.Logo' });
    expect(make(ref('Company.Logo'), lines)).toMatchObject({ imageKey: '$.Company.Logo' });
  });

  it('makes the GİB karekod field a karekod QR in the top-right corner', () => {
    const el = make(ref(GIB_QR_FIELD))!;
    expect(el).toMatchObject({ type: 'barcode', barcodeType: 'qr', dataSource: GIB_QR_FIELD, magnification: 2, width: 22.5, x: 47.5, y: 1 });
    expect(el.content).toBeUndefined();
  });

  it('refuses a band that cannot print the field', () => {
    expect(make(ref('Product.Name', 'Lines'), header)).toBeNull();
  });

  it('produces valid template output', () => {
    const band = { ...lines, elements: [make(ref('Price', 'Lines'), lines)!, make(ref('Document.Number'), lines)!] };
    const zpl = generateTemplateZpl({ schemaVersion: 2, printer: { widthMm: 72, dpi: 203 }, bands: [band] });
    expect(zpl).toContain('{{Price|fmt=N2}}');
    expect(zpl).toContain('{{$.Document.Number}}');
  });
});

describe('nextFieldPosition', () => {
  const text = createFieldElement(ref('Company.Name'), header, 0, 0, DEFAULT_CATALOG, 72)!;
  const number = createFieldElement(ref('Totals.Grand'), header, 0, 0, DEFAULT_CATALOG, 72)!;

  it('starts at the top-left of an empty band', () => {
    expect(nextFieldPosition(header, text, 72)).toEqual({ x: 2, y: 1 });
  });

  it('goes below the lowest element, numbers against the right edge', () => {
    const band = { ...header, elements: [{ ...text, y: 1 }, { ...text, id: 'b', y: 6, height: 3.6 }] };
    expect(nextFieldPosition(band, text, 72)).toEqual({ x: 2, y: 10.1 });
    expect(nextFieldPosition(band, number, 72)).toEqual({ x: 72 - number.width - 2, y: 10.1 });
  });

  it('falls back to an offset when the band is full', () => {
    const band = { ...header, height: 8, elements: [{ ...text, y: 4 }] };
    expect(nextFieldPosition(band, text, 72)).toEqual({ x: 4, y: 3 });
  });

  it('keeps the fallback inside a short band', () => {
    const lines = { ...header, height: 4.5, elements: [1, 2, 3, 4].map(i => ({ ...text, id: `e${i}`, y: 0.5 })) };
    const { y } = nextFieldPosition(lines, text, 72);
    expect(y + text.height).toBeLessThanOrEqual(4.5);
  });
});

describe('search', () => {
  it('ignores case, Turkish i forms and accents', () => {
    expect(searchFold('İSTANBUL')).toBe('istanbul');
    expect(searchFold('Invoice')).toBe('invoice');
    expect(searchFold('Süt Ürünü Çğş')).toBe('sut urunu cgs');
    expect(searchFold('ılık')).toBe('ilik');
  });

  it('matches the label or the path', () => {
    expect(matchesField(ref('Totals.Grand'), 'genel top')).toBe(true);
    expect(matchesField(ref('Totals.Grand'), 'totals.gr')).toBe(true);
    expect(matchesField(ref('Customer.TaxNumber'), 'musteri vkn')).toBe(true);
    expect(matchesField(ref('Customer.TaxNumber'), 'telefon')).toBe(false);
    expect(matchesField(ref('Customer.TaxNumber'), 'müşteri')).toBe(true);
    expect(matchesField(ref('Customer.TaxNumber'), 'MUSTERI')).toBe(true);
    expect(matchesField(ref('Customer.TaxNumber'), '  ')).toBe(true);
  });

  it('matches the array or the group name of an item field', () => {
    expect(matchesField(ref('Product.Name', 'Lines'), 'lines')).toBe(true);
    expect(matchesField(ref('Product.Name', 'Lines'), 'satirlar', 'Satırlar')).toBe(true);
    expect(matchesField(ref('Company.Name'), 'satirlar', 'Company')).toBe(false);
  });
});
