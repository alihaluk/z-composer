import { describe, expect, it } from 'vitest';
import { elementLines, generateTemplateZpl, markerId } from './zplTemplate';
import { fillTemplate } from './zplFill';
import { parseZpl } from '../preview/zplParser';
import { type Template, type TemplateElement } from '../types';

const text = (overrides: Partial<TemplateElement> = {}): TemplateElement => ({
  id: 't1', type: 'text', x: 2, y: 1, width: 40, height: 4, fontSize: 3, content: 'Hi', ...overrides,
});

const template = (overrides: Partial<Template> = {}): Template => ({
  schemaVersion: 2,
  printer: { widthMm: 72, dpi: 203 },
  bands: [
    { id: 'head', name: 'Header', height: 10, elements: [text({ isDynamic: true, dataSource: 'Doc.No' })] },
    { id: 'lines', name: 'Lines', repeat: 'Lines', height: 5, elements: [text({ y: 0.5, isDynamic: true, dataSource: 'Name' })] },
    { id: 'foot', name: 'Footer', height: 8, condition: { path: 'Total', op: 'notZero' }, elements: [text({ isDynamic: true, dataSource: 'Total', format: 'N2' })] },
  ],
  ...overrides,
});

describe('elementLines', () => {
  it('converts millimetres to dots for the printer resolution', () => {
    expect(elementLines(text(), 203)).toEqual(['^FO16,8^A0N,24,24^FH_^FDHi^FS']);
    expect(elementLines(text(), 300)).toEqual(['^FO24,12^A0N,36,36^FH_^FDHi^FS']);
  });

  it('escapes static text so that ^, ~, _ and { cannot break the format', () => {
    expect(elementLines(text({ content: 'a^b~c_d{{e}}' }), 203)[0]).toContain('^FDa_5Eb_7Ec_5Fd_7B_7Be}}^FS');
  });

  it('writes placeholders with format, culture and truncation options', () => {
    const line = elementLines(text({ isDynamic: true, dataSource: 'Total', format: 'N2', invariant: true, overflow: 'truncate', maxChars: 8 }), 203)[0];
    expect(line).toContain('^FD{{Total|fmt=N2|inv|max=8}}^FS');
  });

  it('prints bold text twice, one dot apart', () => {
    expect(elementLines(text({ fontBold: true }), 203)).toEqual(['^FO16,8^A0N,24,24^FH_^FDHi^FS', '^FO17,8^A0N,24,24^FH_^FDHi^FS']);
  });

  it('uses a field block for alignment and wrapping', () => {
    expect(elementLines(text({ align: 'right' }), 203)[0]).toContain('^FB320,1,0,R');
    expect(elementLines(text({ overflow: 'wrap', maxLines: 3, align: 'center' }), 203)[0]).toContain('^FB320,3,4,C');
  });

  it('marks growing text with its wrapping parameters', () => {
    const lines = elementLines(text({ overflow: 'wrap', maxLines: 3, grow: true, charsPerLine: 24 }), 203);
    expect(lines[0]).toBe('^FX ZC:GROW cpl=24 lines=3 lineHeight=28');
  });

  it('wraps conditional elements in an IF block', () => {
    expect(elementLines(text({ condition: { path: 'Discount', op: 'notZero' } }), 203)).toEqual([
      '^FX ZC:IF Discount notZero', '^FO16,8^A0N,24,24^FH_^FDHi^FS', '^FX ZC:ENDIF',
    ]);
  });

  it('renders boxes, Code 128, QR and dynamic images', () => {
    expect(elementLines({ id: 'b', type: 'box', x: 0, y: 0, width: 10, height: 0.1, thickness: 0.25 }, 203)).toEqual(['^FO0,0^GB80,2,2^FS']);
    expect(elementLines({ id: 'c', type: 'barcode', x: 0, y: 0, width: 30, height: 10, content: '123', moduleWidth: 3 }, 203)[0]).toBe('^FO0,0^BY3^BCN,80,Y,N,N^FH_^FD123^FS');
    expect(elementLines({ id: 'q', type: 'barcode', barcodeType: 'qr', x: 0, y: 0, width: 20, height: 20, isDynamic: true, dataSource: 'Qr', magnification: 4 }, 203)[0]).toBe('^FO0,0^BQN,2,4^FH_^FDQA,{{Qr}}^FS');
    expect(elementLines({ id: 'i', type: 'image', x: 0, y: 0, width: 10, height: 5, imageKey: 'Company.Logo' }, 203)).toEqual([
      '^FX ZC:IMAGE key=Company.Logo width=80 height=40', '^FO0,0^GB80,40,1^FS',
    ]);
  });
});

describe('generateTemplateZpl', () => {
  it('follows the template structure of the specification', () => {
    expect(generateTemplateZpl(template())).toBe([
      '^XA', '^FX ZC:TEMPLATE spec=1 dpi=203', '^CI28', '^MNN', '^PW576', '^LL184',
      '^FX ZC:BAND id=head height=80', '^LH0,0', '^FO16,8^A0N,24,24^FH_^FD{{Doc.No}}^FS', '^FX ZC:END',
      '^FX ZC:BAND id=lines height=40 repeat=Lines', '^LH0,80', '^FO16,4^A0N,24,24^FH_^FD{{Name}}^FS', '^FX ZC:END',
      '^FX ZC:IF Total notZero', '^FX ZC:BAND id=foot height=64', '^LH0,120', '^FO16,8^A0N,24,24^FH_^FD{{Total|fmt=N2}}^FS', '^FX ZC:END', '^FX ZC:ENDIF',
      '^LH0,0', '^XZ',
    ].join('\n'));
  });

  it('produces output that the filler and the preview parser understand', () => {
    const filled = fillTemplate(generateTemplateZpl(template()), { Doc: { No: 'A1' }, Lines: [{ Name: 'x' }, { Name: 'y' }], Total: 3 }, { locale: 'tr-TR' });
    const label = parseZpl(filled);
    expect(label.length).toBe(80 + 40 * 2 + 64);
    expect(label.items.map(i => (i.kind === 'text' ? [i.text, i.y] : null))).toEqual([['A1', 8], ['x', 84], ['y', 124], ['3,00', 168]]);
  });

  it('makes band ids valid marker ids', () => {
    expect(markerId('1a b')).toBe('b1ab');
    expect(markerId('head')).toBe('head');
  });
});

describe('Code 128 static data', () => {
  it('escapes > for ^BC but not for text', () => {
    expect(elementLines({ id: 'c', type: 'barcode', x: 0, y: 0, width: 30, height: 10, content: 'A>B' }, 203)[0]).toContain('^FDA>0B^FS');
    expect(elementLines({ id: 't', type: 'text', x: 0, y: 0, width: 30, height: 4, content: 'A>B' }, 203)[0]).toContain('^FDA>B^FS');
  });
});

describe('field block static data', () => {
  it('doubles backslashes only when the text uses ^FB', () => {
    expect(elementLines(text({ content: 'a\\b', align: 'right' }), 203)[0]).toContain('^FDa\\\\b^FS');
    expect(elementLines(text({ content: 'a\\b' }), 203)[0]).toContain('^FDa\\b^FS');
  });
});

describe('uploaded images', () => {
  it('are encoded at the element size, so resizing changes the printed graphic', () => {
    const bitmap = { width: 4, height: 2, data: btoa(String.fromCharCode(...new Array(8).fill(0))) };
    const line = (width: number) => elementLines({ id: 'i', type: 'image', x: 0, y: 0, width, height: 10, bitmap }, 203)[0];
    expect(line(4)).toMatch(/^\^FO0,0\^GFA,64,64,4,F{128}\^FS$/);
    expect(line(8)).toMatch(/^\^FO0,0\^GFA,256,256,8,F{512}\^FS$/);
  });
});

describe('composed content', () => {
  const parts = [{ text: 'No: ' }, { path: 'Doc.No', max: 8 }, { text: ' / ' }, { path: 'Total', format: 'F2', invariant: true }, { path: '' }];

  it('writes static parts escaped and fields as placeholders, leaving out unchosen fields', () => {
    expect(elementLines(text({ isDynamic: true, parts: [{ text: '{_' }, ...parts] }), 203)[0])
      .toBe('^FO16,8^A0N,24,24^FH_^FD_7B_5FNo: {{Doc.No|max=8}} / {{Total|fmt=F2|inv}}^FS');
  });

  it('escapes static parts for Code 128 and field blocks', () => {
    expect(elementLines(text({ type: 'barcode', barcodeType: 'code128', isDynamic: true, parts: [{ text: 'A>' }, { path: 'Code' }] }), 203)[0]).toContain('^FDA>0{{Code}}^FS');
    expect(elementLines(text({ overflow: 'wrap', isDynamic: true, parts: [{ text: 'a\\b ' }, { path: 'X' }] }), 203)[0]).toContain('^FDa\\\\b {{X}}^FS');
  });

  it('fills like any field with several placeholders', () => {
    const tpl = template({ bands: [{ id: 'a', name: 'A', height: 5, elements: [text({ isDynamic: true, parts })] }] });
    expect(fillTemplate(generateTemplateZpl(tpl), { Doc: { No: 'FTR_2026000123' }, Total: 2751.5 }, { locale: 'tr-TR' }))
      .toContain('^FDNo: FTR_5F2026 / 2751.50^FS');
  });

  it('uses static content again when the element is no longer dynamic', () => {
    expect(elementLines(text({ isDynamic: false, parts, content: 'Hi' }), 203)[0]).toContain('^FDHi^FS');
  });
});
