// Files and templates from outside are untrusted: what they must not be able to do.
import { afterEach, describe, expect, it } from 'vitest';
import { catalogFromJsonSchema, catalogFromSample, isValidPath, parseCatalog, sampleFromCatalog } from './catalogIO';
import { readJsonFile } from './download';
import { bitmapToZpl, isImageDataUrl } from './imageUtils';
import { isValidFormat, parseTemplate } from './templateIO';
import { fillTemplate, lookup, wrapText } from './zplFill';
import { generateTemplateZpl } from './zplTemplate';

const proto = Object.prototype as unknown as Record<string, unknown>;
const template = (element: object, band: object = {}, printer: object = {}) => ({
  schemaVersion: 2, printer: { widthMm: 72, dpi: 203, ...printer },
  bands: [{ id: 'b', name: 'B', height: 10, ...band, elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 3, ...element }] }],
});
const head = '^XA\n^FX ZC:TEMPLATE spec=1 dpi=203\n^LL1\n^FX ZC:BAND id=b height=10\n^LH0,0\n';

describe('prototype pollution', () => {
  afterEach(() => { for (const key of ['polluted', 'isAdmin']) delete proto[key]; });

  it('a JSON Schema cannot write to Object.prototype', () => {
    const viaProto = JSON.parse('{"properties":{"a":{"type":"string"},"__proto__":{"type":"object","properties":{"polluted":{"type":"string"}}}}}');
    const viaConstructor = { properties: { a: { type: 'string' }, constructor: { type: 'object', properties: { prototype: { type: 'object', properties: { isAdmin: { type: 'boolean' } } } } } } };
    expect(catalogFromJsonSchema(viaProto, 'x').skipped).toEqual(['__proto__: name']);
    expect(catalogFromJsonSchema(viaConstructor, 'x').skipped).toEqual(['constructor: name']);
    expect(proto.polluted).toBeUndefined();
    expect(proto.isAdmin).toBeUndefined();
  });

  it('a catalog given directly to sampleFromCatalog cannot either', () => {
    sampleFromCatalog({ catalogVersion: 1, name: 'x', fields: [{ path: '__proto__.polluted', type: 'string' }, { path: 'constructor.prototype.isAdmin', type: 'boolean' }] });
    expect(proto.polluted).toBeUndefined();
    expect(proto.isAdmin).toBeUndefined();
  });

  it('reserved names are no fields anywhere', () => {
    for (const path of ['__proto__', 'a.constructor', 'prototype.b', '$.__proto__.x']) expect(isValidPath(path)).toBe(false);
    expect(isValidPath('Constructor')).toBe(true);
    expect(() => parseCatalog({ catalogVersion: 1, fields: [{ path: 'constructor', type: 'string' }] })).toThrow('invalid path');
    expect(() => parseTemplate(template({ isDynamic: true, dataSource: 'constructor.name' }))).toThrow('invalid field path');
    expect(catalogFromSample(JSON.parse('{"__proto__":{"x":1},"a":1}'), 'x').catalog.fields.map(f => f.path)).toEqual(['a']);
  });

  it('lookup reads only own properties', () => {
    expect(lookup({}, {}, 'constructor')).toBeUndefined();
    expect(lookup({}, {}, '__proto__.toString')).toBeUndefined();
    expect(lookup({ a: { b: 1 } }, {}, 'a.b')).toBe(1);
    expect(lookup({ a: [1, 2] }, {}, 'a.length')).toBe(2);
  });
});

describe('JSON Schema expansion', () => {
  const recursive = (n: number) => ({ definitions: { N: { type: 'object', properties: Object.fromEntries('abcdefghijklmnop'.slice(0, n).split('').map(k => [k, { $ref: '#/definitions/N' }])) } }, $ref: '#/definitions/N' });

  it('refuses a schema that expands without end, quickly', () => {
    const start = Date.now();
    expect(() => catalogFromJsonSchema(recursive(12), 'x')).toThrow('too many fields');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('names a circular reference', () => {
    expect(() => catalogFromJsonSchema({ definitions: { A: { $ref: '#/definitions/B' }, B: { $ref: '#/definitions/A' } }, $ref: '#/definitions/A' }, 'x')).toThrow('Circular reference');
  });

  it('does not follow references into inherited properties', () => {
    expect(() => catalogFromJsonSchema({ $ref: '#/constructor/prototype' }, 'x')).toThrow('Unresolved reference');
  });
});

describe('images', () => {
  it('accepts only embedded images', () => {
    expect(isImageDataUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isImageDataUrl('data:image/svg+xml,<svg/>')).toBe(true);
    for (const value of ['https://example.test/a.png', '//example.test/a.png', 'javascript:alert(1)', 'data:text/html,x', ' data:image/png;base64,AA', 5]) expect(isImageDataUrl(value)).toBe(false);
    expect(() => parseTemplate(template({ type: 'image', imageBase64: 'https://example.test/a.png' }))).toThrow('imageBase64 must be an embedded');
  });

  it.each([
    ['invalid base64', { width: 2, height: 2, data: '%%%bad' }],
    ['data shorter than the size', { width: 2, height: 2, data: 'AAAA' }],
    ['a huge size', { width: 100000, height: 100000, data: 'AAAA' }],
  ])('refuses a bitmap with %s', (_, bitmap) => {
    expect(() => parseTemplate(template({ type: 'image', bitmap }))).toThrow('bitmap must have');
  });

  it('accepts a real bitmap and generates it', () => {
    const t = parseTemplate(template({ type: 'image', bitmap: { width: 2, height: 2, data: 'AAAAAA==' } }));
    expect(generateTemplateZpl(t)).toContain('^GFA');
  });

  it('keeps a graphic for a huge box within limits', () => {
    const start = Date.now();
    const graphic = bitmapToZpl({ width: 2, height: 2, data: 'AAAAAA==' }, 1e7, 1e7);
    expect(graphic.width * graphic.height).toBeLessThanOrEqual(64_000_000);
    expect(Date.now() - start).toBeLessThan(10_000);
  }, 20_000);
});

describe('sizes and formats in a template', () => {
  it.each([
    ['paper width', template({}, {}, { widthMm: 1e308 }), 'printer.widthMm'],
    ['band height', template({}, { height: 1e9 }), 'positive height'],
    ['position', template({ x: 1e308 }), 'x must be'],
    ['element size', template({ width: 200000 }), 'width must be'],
    ['font size', template({ fontSize: 1e9 }), 'fontSize must be'],
  ])('refuses an impossible %s', (_, t, message) => {
    expect(() => parseTemplate(t)).toThrow(message);
  });

  it('refuses a format with ZPL or placeholder syntax', () => {
    for (const format of ['^XZ', '~JR', '{{a', 'a}', 'a|b', 'a\nb']) expect(isValidFormat(format)).toBe(false);
    expect(isValidFormat('dd.MM.yyyy HH:mm')).toBe(true);
  });

  it('refuses a very large file before reading it', async () => {
    const file = { size: 60 * 1024 * 1024, text: () => { throw new Error('read'); } } as unknown as File;
    await expect(readJsonFile(file)).rejects.toThrow('too large');
  });
});

describe('filler', () => {
  const grow = (attrs: string) => `${head}^FX ZC:GROW ${attrs}\n^FO0,0^A0N,24,24^FB100,2,0,L^FH_^FD{{a}}^FS\n^FX ZC:END\n^XZ`;
  const fill = (zpl: string, data: object = { a: 'abc' }) => fillTemplate(zpl, data, { locale: 'tr-TR' });

  it.each(['cpl=0 lines=2 lineHeight=24', 'cpl=-1 lines=2 lineHeight=24', 'cpl=x lines=2 lineHeight=24', 'cpl=5 lines=0 lineHeight=24', 'cpl=5 lines=2', 'lines=2 lineHeight=24'])('rejects GROW %s', attrs => {
    expect(() => fill(grow(attrs))).toThrow('Invalid template');
  });

  it('rejects other invalid marker numbers', () => {
    expect(() => fill(head.replace('height=10', 'height=1e308') + '^FX ZC:END\n^XZ')).toThrow('Invalid template');
    expect(() => fill(`${head}^FX ZC:IMAGE key=a width=0 height=5\n^FO0,0^GB1,1,1^FS\n^FX ZC:END\n^XZ`)).toThrow('Invalid template');
  });

  it('wrapText refuses a line width that could never finish', () => {
    expect(() => wrapText('abc', 0, 2)).toThrow();
    expect(() => wrapText('abc', -1, 2)).toThrow();
  });

  it('takes linear time on long lines of unclosed markers', () => {
    const start = Date.now();
    fill(`${head}^FO0,0^FD${'{{'.repeat(1_000_000)}^FS\n^FX ZC:END\n^XZ`);
    fill(`${head}^FX ZC:GROW cpl=5 lines=2 lineHeight=24\n${'^FD'.repeat(1_000_000)}\n^FX ZC:END\n^XZ`);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('keeps the replacement rules of the old regex', () => {
    const line = (body: string) => fill(`${head}^FO0,0^FH_^FD${body}^FS\n^FX ZC:END\n^XZ`, { a: 'x', b: 'y' }).split('\n').find(l => l.includes('^FD'));
    expect(line('{{a}}-{{b}}')).toBe('^FO0,0^FH_^FDx-y^FS');
    expect(line('{{a}')).toBe('^FO0,0^FH_^FD{{a}^FS');
    expect(line('{{{a}}')).toBe('^FO0,0^FH_^FD^FS');
    expect(line('}}{{a}}')).toBe('^FO0,0^FH_^FD}}x^FS');
  });
});
