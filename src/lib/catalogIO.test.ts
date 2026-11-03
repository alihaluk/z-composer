import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from './catalog';
import { catalogFromJsonSchema, catalogFromSample, fieldsUsed, isValidPath, missingFields, parseCatalog, sampleFromCatalog } from './catalogIO';
import { invoicePreset } from './presets';
import { parseTemplate } from './templateIO';
import { type Template } from '../types';

describe('isValidPath', () => {
  it.each([['Customer.Name', true], ['$.Total', true], ['Müşteri.Adı_2', true], ['a b', false], ['a|b', false], ['1abc', false], ['a..b', false], ['', false]])('%s -> %s', (path, ok) => {
    expect(isValidPath(path)).toBe(ok);
  });
});

describe('catalogFromSample', () => {
  it('infers fields, types and repeat arrays from an example document', () => {
    const sample = {
      Invoice: { No: 'A1', Date: '2026-11-13T10:00:00', Due: '2026-12-01', Paid: false, Logo: 'data:image/png;base64,AA==' },
      Total: 12.5,
      Lines: [{ Name: 'x', Qty: 1 }, { Name: 'y', Price: 2 }],
      Tags: ['a', 'b'],
      'Bad Key': 1,
    };
    const { catalog, skipped } = catalogFromSample(sample, 'Test');
    expect(catalog.fields).toEqual([
      { path: 'Invoice.No', type: 'string' },
      { path: 'Invoice.Date', type: 'datetime' },
      { path: 'Invoice.Due', type: 'date' },
      { path: 'Invoice.Paid', type: 'boolean' },
      { path: 'Invoice.Logo', type: 'image' },
      { path: 'Total', type: 'number' },
      { path: 'Lines', type: 'array', items: [{ path: 'Name', type: 'string' }, { path: 'Price', type: 'number' }, { path: 'Qty', type: 'number' }] },
    ]);
    expect(catalog.sample).toBe(sample);
    expect(skipped).toEqual(['Tags: array of values', 'Bad Key: name']);
  });

  it('accepts arrays inside objects but not arrays inside array items', () => {
    const { catalog, skipped } = catalogFromSample({ Doc: { Lines: [{ A: 1, Sub: [{ B: 2 }] }] } }, 'x');
    expect(catalog.fields).toEqual([{ path: 'Doc.Lines', type: 'array', items: [{ path: 'A', type: 'number' }] }]);
    expect(skipped).toEqual(['Sub: nested array']);
  });
});

describe('catalogFromJsonSchema', () => {
  const schema = {
    title: 'InvoiceDto',
    type: 'object',
    $defs: { Line: { type: 'object', properties: { Name: { type: 'string', title: 'Product' }, Qty: { type: 'integer' } } } },
    properties: {
      Number: { type: 'string' },
      Date: { type: ['string', 'null'], format: 'date-time' },
      Customer: { type: 'object', properties: { Name: { type: 'string' } } },
      Lines: { type: 'array', items: { $ref: '#/$defs/Line' } },
      Codes: { type: 'array', items: { type: 'string' } },
    },
  };

  it('reads properties, formats, titles and local references', () => {
    const { catalog, skipped } = catalogFromJsonSchema(schema, 'fallback');
    expect(catalog.name).toBe('InvoiceDto');
    expect(catalog.fields).toEqual([
      { path: 'Number', type: 'string' },
      { path: 'Date', type: 'datetime' },
      { path: 'Customer.Name', type: 'string' },
      { path: 'Lines', type: 'array', items: [{ path: 'Name', type: 'string', label: 'Product' }, { path: 'Qty', type: 'number' }] },
    ]);
    expect(skipped).toEqual(['Codes: array of values']);
  });

  it('generates sample data so previews are not empty', () => {
    expect(catalogFromJsonSchema(schema, 'x').catalog.sample).toEqual({
      Number: 'Number', Date: '2026-11-13T14:37:00', Customer: { Name: 'Name' },
      Lines: [{ Name: 'Name', Qty: 1234.5 }, { Name: 'Name 2', Qty: 2469 }],
    });
  });

  it('rejects unresolved references and empty schemas', () => {
    expect(() => catalogFromJsonSchema({ properties: { A: { $ref: '#/nope' } } }, 'x')).toThrow('Unresolved reference');
    expect(() => catalogFromJsonSchema({ type: 'object' }, 'x')).toThrow('no properties');
  });
});

describe('parseCatalog', () => {
  it('accepts the default catalog after a JSON round trip', () => {
    expect(parseCatalog(JSON.parse(JSON.stringify(DEFAULT_CATALOG)))).toEqual(DEFAULT_CATALOG);
  });

  it.each([
    [{ catalogVersion: 2, fields: [] }, 'catalogVersion 1'],
    [{ catalogVersion: 1, fields: [{ path: 'a b', type: 'string' }] }, 'invalid path'],
    [{ catalogVersion: 1, fields: [{ path: 'a', type: 'money' }] }, 'unknown type'],
    [{ catalogVersion: 1, fields: [{ path: 'L', type: 'array', items: [{ path: 'M', type: 'array' }] }] }, 'cannot be nested'],
  ])('rejects %j', (json, message) => {
    expect(() => parseCatalog(json)).toThrow(message);
  });
});

describe('missingFields and fieldsUsed', () => {
  it('finds nothing missing for the preset on the default catalog', () => {
    expect(missingFields(invoicePreset(), DEFAULT_CATALOG)).toEqual([]);
  });

  it('reports fields, repeat arrays and images the catalog does not provide', () => {
    const t: Template = parseTemplate({
      schemaVersion: 2, printer: { widthMm: 72, dpi: 203 },
      bands: [
        { id: 'a', name: 'A', height: 5, repeat: 'Rows', elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 1, height: 1, isDynamic: true, dataSource: 'Name' }] },
        { id: 'b', name: 'B', height: 5, elements: [{ id: 'i', type: 'image', x: 0, y: 0, width: 1, height: 1, imageKey: 'Customer.Name' }] },
      ],
    });
    expect(missingFields(t, DEFAULT_CATALOG)).toEqual(['Rows', 'Name', 'Customer.Name']);
  });

  it('records item fields with their array', () => {
    const used = fieldsUsed(invoicePreset(), DEFAULT_CATALOG);
    expect(used).toContainEqual({ path: 'Lines[].Product.Name', type: 'string' });
    expect(used).toContainEqual({ path: 'Lines', type: 'array' });
    expect(used).toContainEqual({ path: 'Totals.Grand', type: 'number' });
  });
});

describe('sampleFromCatalog', () => {
  it('builds nested objects and two items per array', () => {
    const sample = sampleFromCatalog({ catalogVersion: 1, name: 'x', fields: [{ path: 'A.B', type: 'number' }, { path: 'L', type: 'array', items: [{ path: 'C', type: 'string' }] }] });
    expect(sample).toEqual({ A: { B: 1234.5 }, L: [{ C: 'C' }, { C: 'C 2' }] });
  });
});

describe('JSON Schema from .NET / Java generators', () => {
  it('unwraps nullable references written as oneOf / anyOf / allOf', () => {
    const schema = {
      definitions: {
        Customer: { type: 'object', properties: { Name: { type: 'string' } } },
        Line: { type: 'object', properties: { Qty: { type: 'number' } } },
      },
      type: 'object',
      properties: {
        Customer: { oneOf: [{ type: 'null' }, { $ref: '#/definitions/Customer' }] },
        Billing: { anyOf: [{ $ref: '#/definitions/Customer' }, { type: 'null' }], title: 'Bill to' },
        Lines: { type: ['array', 'null'], items: { allOf: [{ $ref: '#/definitions/Line' }] } },
        Either: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      },
    };
    expect(catalogFromJsonSchema(schema, 'x').catalog.fields).toEqual([
      { path: 'Customer.Name', type: 'string' },
      { path: 'Billing.Name', type: 'string' },
      { path: 'Lines', type: 'array', items: [{ path: 'Qty', type: 'number' }] },
      { path: 'Either', type: 'string' },
    ]);
  });
});

describe('changedFields', () => {
  it('reports fields whose type changed since the template was saved', async () => {
    const { changedFields } = await import('./catalogIO');
    const t = { ...invoicePreset(), fieldsUsed: [{ path: 'Totals.Grand', type: 'string' }, { path: 'Gone', type: 'number' }] };
    expect(changedFields(t, DEFAULT_CATALOG)).toEqual([{ path: 'Totals.Grand', was: 'string', now: 'number' }]);
    expect(changedFields(invoicePreset(), DEFAULT_CATALOG)).toEqual([]);
  });
});
