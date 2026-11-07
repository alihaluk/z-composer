import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, type Catalog } from './catalog';
import { barcodeSamples, checkDesign, withRootPrefix } from './designCheck';
import { invoicePreset } from './presets';
import { type Band, type Template, type TemplateElement } from '../types';

const text = (patch: Partial<TemplateElement> = {}): TemplateElement => ({ id: 't', type: 'text', x: 2, y: 1, width: 30, height: 3.6, fontSize: 3, content: 'Kısa', ...patch });
const template = (bands: Band[], widthMm = 72): Template => ({ schemaVersion: 2, printer: { widthMm, dpi: 203 }, bands });
const header = (elements: TemplateElement[], patch: Partial<Band> = {}): Band => ({ id: 'h', name: 'Header', height: 30, elements, ...patch });
const kinds = (t: Template, catalog: Catalog = DEFAULT_CATALOG) => checkDesign(t, catalog, 'tr-TR').map(i => i.kind);

describe('checkDesign', () => {
  it('finds nothing wrong in the invoice preset', () => {
    expect(checkDesign(invoicePreset(), DEFAULT_CATALOG, 'tr-TR')).toEqual([]);
  });

  it('flags elements past the paper edge and past their band', () => {
    const issues = checkDesign(template([header([text({ x: 50, width: 30 }), text({ id: 'u', y: 28 })])]), DEFAULT_CATALOG, 'tr-TR');
    expect(issues).toEqual([
      expect.objectContaining({ kind: 'outsidePage', severity: 'error', elementId: 't', value: 80, limit: 72 }),
      expect.objectContaining({ kind: 'outsideBand', severity: 'warning', elementId: 'u', value: 31.6, limit: 30 }),
    ]);
    // A line across the whole page is not past the edge.
    expect(kinds(template([header([text({ x: 0, width: 72 })])]))).toEqual([]);
  });

  it('flags left-aligned sample text that runs past the paper', () => {
    const long = text({ x: 40, isDynamic: true, dataSource: 'Company.Address', content: undefined });
    const [issue] = checkDesign(template([header([long])]), DEFAULT_CATALOG, 'tr-TR');
    expect(issue).toMatchObject({ kind: 'textCut', severity: 'error', limit: 32, text: 'Atatürk Cad. No:1 Kadıköy / İstanbul' });
    expect(issue.value).toBeGreaterThan(32);
    // From the left margin it fits on the page; running past its own box is allowed.
    expect(kinds(template([header([{ ...long, x: 2 }])]))).toEqual([]);
  });

  it('flags centred or right-aligned text wider than its box', () => {
    const el = text({ align: 'right', width: 20, content: 'Genel toplam tutarı' });
    expect(checkDesign(template([header([el])]), DEFAULT_CATALOG, 'tr-TR')[0]).toMatchObject({ kind: 'textCut', limit: 20 });
    expect(kinds(template([header([{ ...el, width: 40 }])]))).toEqual([]);
  });

  it('checks every row of a repeating band, not only the first', () => {
    const lines: Band = { id: 'l', name: 'Lines', height: 8, repeat: 'Lines', elements: [text({ isDynamic: true, dataSource: 'Product.Name', content: undefined, align: 'center', width: 25 })] };
    const issue = checkDesign(template([lines]), DEFAULT_CATALOG, 'tr-TR')[0];
    // "Süt 1L" fits; a later row's name does not.
    expect(issue).toMatchObject({ kind: 'textCut', bandId: 'l' });
    expect(issue.text).not.toBe('Süt 1L');
  });

  it('flags wrapped text that needs more lines than it may use', () => {
    const el = text({ isDynamic: true, dataSource: 'Company.Address', content: undefined, width: 20, overflow: 'wrap', maxLines: 1 });
    expect(checkDesign(template([header([el])]), DEFAULT_CATALOG, 'tr-TR')[0]).toMatchObject({ kind: 'linesCut', severity: 'warning', limit: 1 });
    expect(kinds(template([header([{ ...el, maxLines: 4 }])]))).toEqual([]);
    // Growing text is broken by characters per line, as the filler does.
    expect(kinds(template([header([{ ...el, grow: true, maxLines: 1 }])]))).toEqual(['linesCut']);
  });

  it('flags bindings the catalog does not have', () => {
    const t = template([header([
      text({ id: 'a', isDynamic: true, dataSource: 'Customer.Phone' }),
      text({ id: 'b', isDynamic: true, parts: [{ text: 'No: ' }, { path: 'Document.Nmber' }] }),
      text({ id: 'c', condition: { path: 'Nope', op: 'notEmpty' } }),
      { id: 'd', type: 'image', x: 2, y: 1, width: 10, height: 5, imageKey: 'Company.Name' },
    ], { repeat: 'Totals' })]);
    expect(checkDesign(t, DEFAULT_CATALOG, 'tr-TR').map(i => [i.kind, i.elementId ?? null, i.path])).toEqual([
      ['missingField', null, 'Totals'],
      ['missingField', 'a', 'Customer.Phone'],
      ['missingField', 'b', 'Document.Nmber'],
      ['missingField', 'c', 'Nope'],
      ['missingField', 'd', 'Company.Name'],
    ]);
  });

  it('allows conditions on arrays and explains document fields in repeating bands', () => {
    const lines: Band = {
      id: 'l', name: 'Lines', height: 8, repeat: 'Lines', condition: { path: 'Lines', op: 'notEmpty' },
      elements: [text({ isDynamic: true, dataSource: 'Document.Number', content: undefined })],
    };
    expect(checkDesign(template([lines]), DEFAULT_CATALOG, 'tr-TR')).toEqual([
      expect.objectContaining({ kind: 'rootPrefix', severity: 'error', path: 'Document.Number' }),
    ]);
    lines.elements[0].dataSource = '$.Document.Number';
    expect(kinds(template([lines]))).toEqual([]);
  });

  it('flags fields that are not chosen and elements that print nothing', () => {
    const t = template([header([
      text({ id: 'a', isDynamic: true, content: undefined }),
      text({ id: 'b', isDynamic: true, parts: [{ path: '' }] }),
      { id: 'c', type: 'image', x: 2, y: 1, width: 10, height: 5 },
    ])]);
    expect(kinds(t)).toEqual(['noField', 'emptyContent', 'noImage']);
  });

  it('skips sample checks without sample data', () => {
    const el = text({ x: 40, isDynamic: true, dataSource: 'Company.Address', content: undefined });
    expect(kinds(template([header([el])]), { ...DEFAULT_CATALOG, sample: undefined })).toEqual([]);
  });

  it('flags barcodes wider than the paper from their measured width', () => {
    const bc: TemplateElement = { id: 'b', type: 'barcode', barcodeType: 'code128', x: 30, y: 1, width: 40, height: 10, content: '1234567890' };
    const t = template([header([bc])]);
    // 400 dots are 50 mm at 203 dpi (8 dots per mm); from x = 30 mm only 42 mm are left.
    expect(checkDesign(t, DEFAULT_CATALOG, 'tr-TR', { b: 400 })[0]).toMatchObject({ kind: 'barcodeCut', limit: 42, value: 50 });
    expect(checkDesign(t, DEFAULT_CATALOG, 'tr-TR', { b: 200 })).toEqual([]);
  });
});

describe('barcodeSamples', () => {
  it('gives every distinct sample text of each barcode', () => {
    const lines: Band = { id: 'l', name: 'Lines', height: 12, repeat: 'Lines', elements: [
      { id: 'b', type: 'barcode', barcodeType: 'code128', x: 2, y: 1, width: 40, height: 10, isDynamic: true, dataSource: 'Product.Code' },
    ] };
    const [sample] = barcodeSamples(template([lines]), DEFAULT_CATALOG, 'tr-TR');
    expect(sample).toMatchObject({ id: 'b', kind: 'code128' });
    const codes = (DEFAULT_CATALOG.sample as { Lines: { Product: { Code: string } }[] }).Lines.map(l => l.Product.Code);
    expect(sample.texts).toEqual(codes);
  });
});

describe('withRootPrefix', () => {
  it('binds every use of the path from the root', () => {
    const el = text({ isDynamic: true, parts: [{ text: 'No ' }, { path: 'Document.Number' }], condition: { path: 'Document.Number', op: 'notEmpty' } });
    expect(withRootPrefix(el, 'Document.Number')).toEqual({
      parts: [{ text: 'No ' }, { path: '$.Document.Number' }],
      condition: { path: '$.Document.Number', op: 'notEmpty' },
    });
    expect(withRootPrefix(text({ isDynamic: true, dataSource: 'Totals.Grand' }), 'Totals.Grand')).toEqual({ dataSource: '$.Totals.Grand' });
  });
});
