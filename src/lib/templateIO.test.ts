import { describe, expect, it } from 'vitest';
import { emptyTemplate, parseTemplate } from './templateIO';

const v1 = {
  canvasWidth: 80,
  header: { height: 40, elements: [{ id: 'a', type: 'text', x: 37.8, y: 18.9, fontSize: 12, isDynamic: true, dataSource: 'Customer.Name', maxChars: 20 }] },
  body: { height: 10, elements: [
    { id: 'b', type: 'text', x: 0, y: 0, isDynamic: true, dataSource: 'Product.Name' },
    { id: 'c', type: 'text', x: 0, y: 0, isDynamic: true, dataSource: 'DocNumber' },
  ] },
  footer: { height: 20, elements: [{ id: 'q', type: 'barcode', barcodeType: 'qr', x: 0, y: 0, width: 80, height: 80, isDynamic: true, dataSource: 'GibInfo' }] },
  version: 1,
};

describe('parseTemplate', () => {
  it('migrates v1 templates to bands in millimetres', () => {
    const t = parseTemplate(v1);
    expect(t.schemaVersion).toBe(2);
    expect(t.printer).toEqual({ widthMm: 80, dpi: 203 });
    expect(t.bands.map(b => [b.name, b.height, b.repeat])).toEqual([['Header', 40, undefined], ['Lines', 10, 'Lines'], ['Footer', 20, undefined]]);
    expect(t.bands[0].elements[0]).toMatchObject({ x: 10, y: 5, fontSize: 4.2, overflow: 'truncate', maxChars: 20 });
    expect(t.bands[2].elements[0]).toMatchObject({ barcodeType: 'qr', magnification: 3 });
  });

  it('keeps row fields relative and points document fields in the body to the root', () => {
    const [row, doc] = parseTemplate(v1).bands[1].elements;
    expect(row.dataSource).toBe('Product.Name');
    expect(doc.dataSource).toBe('$.DocNumber');
  });

  it('accepts a valid v2 template unchanged', () => {
    const t = emptyTemplate();
    expect(parseTemplate(JSON.parse(JSON.stringify(t)))).toEqual(t);
  });

  it.each([
    [null, 'not an object'],
    [{ schemaVersion: 2, printer: { widthMm: 72, dpi: 204 }, bands: [] }, 'printer.dpi'],
    [{ schemaVersion: 2, printer: { widthMm: 72, dpi: 203 }, bands: [{ id: 'a', height: 0, elements: [] }] }, 'band 0'],
    [{ schemaVersion: 2, printer: { widthMm: 72, dpi: 203 }, bands: [{ id: 'a', height: 5, elements: [{ id: 'x', type: 'circle' }] }] }, 'known type'],
    [{ schemaVersion: 3 }, 'newer'],
    [{ foo: 1 }, 'unknown format'],
  ])('rejects %j', (json, message) => {
    expect(() => parseTemplate(json)).toThrow(message);
  });
});
