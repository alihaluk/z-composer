import { describe, expect, it } from 'vitest';
import { decodeFieldData, parseZpl } from './zplParser';

describe('decodeFieldData', () => {
  it('decodes ^FH escapes', () => {
    expect(decodeFieldData('Peynir_5FBeyaz _5ETam _7E', '_')).toBe('Peynir_Beyaz ^Tam ~');
  });

  it('decodes escaped UTF-8 bytes and keeps raw Turkish characters', () => {
    expect(decodeFieldData('_C4_B0ndirim ş', '_')).toBe('İndirim ş');
  });

  it('leaves data untouched without ^FH', () => {
    expect(decodeFieldData('a_5Fb')).toBe('a_5Fb');
  });
});

describe('parseZpl', () => {
  it('reads print width and label length', () => {
    expect(parseZpl('^XA^PW576^LL240^XZ')).toMatchObject({ width: 576, length: 240, items: [] });
  });

  it('parses a text field with font, block and escapes', () => {
    const { items } = parseZpl('^XA^FO16,8^A0N,22,22^FB360,3,4,R^FH_^FDa_5Fb\\&c^FS^XZ');
    expect(items).toEqual([{
      kind: 'text', x: 16, y: 8, height: 22, width: 22, orientation: 'N', text: 'a_b\nc',
      block: { width: 360, maxLines: 3, lineSpacing: 4, justify: 'R' },
    }]);
  });

  it('applies the label home to field origins', () => {
    const { items } = parseZpl('^XA^LH0,120^FO16,8^A0N,22,22^FDx^FS^LH0,0^FO1,1^A0N,22,22^FDy^FS^XZ');
    expect(items.map(i => [i.x, i.y])).toEqual([[16, 128], [1, 1]]);
  });

  it('ignores comments and line breaks between commands', () => {
    const { items } = parseZpl('^XA\n^FX ZC:BAND id=a height=10\n^FO1,2^A0R,30,20^FDHi^FS\n^XZ');
    expect(items).toEqual([{ kind: 'text', x: 1, y: 2, height: 30, width: 20, orientation: 'R', text: 'Hi', block: undefined }]);
  });

  it('parses boxes and widens them to the border thickness', () => {
    const { items } = parseZpl('^XA^FO5,6^GB212,106,2^FS^FO0,0^GB1,1,3^FS^XZ');
    expect(items).toEqual([
      { kind: 'box', x: 5, y: 6, width: 212, height: 106, thickness: 2 },
      { kind: 'box', x: 0, y: 0, width: 3, height: 3, thickness: 3 },
    ]);
  });

  it('parses ^GFA graphics', () => {
    const [item] = parseZpl('^XA^FO2,3^GFA,2,2,1,FF00^FS^XZ').items;
    expect(item).toMatchObject({ kind: 'graphic', x: 2, y: 3, bytesPerRow: 1 });
    expect(Array.from((item as { data: Uint8Array }).data)).toEqual([255, 0]);
  });

  it('parses Code 128 with ^BY module width', () => {
    const { items } = parseZpl('^XA^BY3^FO10,20^BCN,106,Y,N,N^FD12345678^FS^XZ');
    expect(items).toEqual([{ kind: 'code128', x: 10, y: 20, height: 106, moduleWidth: 3, orientation: 'N', printText: true, text: '12345678' }]);
  });

  it('parses QR codes and strips the error correction prefix', () => {
    const { items } = parseZpl('^XA^FO10,20^BQN,2,4^FH_^FDMA,a_5Fb^FS^XZ');
    expect(items).toEqual([{ kind: 'qr', x: 10, y: 20, magnification: 4, errorCorrection: 'M', text: 'a_b' }]);
  });
});

describe('Code 128 invocation codes', () => {
  it('reads >0 as > and drops other invocation codes, like the printer', () => {
    const [item] = parseZpl('^XA^FO0,0^BCN,50,Y,N,N^FDA>0B>CD>:E^FS^XZ').items;
    expect(item).toMatchObject({ kind: 'code128', text: 'A>BDE' });
  });
});

describe('field block escapes', () => {
  it('reads \\& as a line break and \\\\ as a backslash', () => {
    const [item] = parseZpl('^XA^FO0,0^A0N,20,20^FB200,3,0,L^FDa\\\\b\\&c\\d^FS^XZ').items;
    expect(item).toMatchObject({ text: 'a\\b\ncd' });
  });
});
