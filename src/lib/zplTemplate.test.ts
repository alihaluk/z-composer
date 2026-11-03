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
