import bwipjs from 'bwip-js/node';
import { describe, expect, it } from 'vitest';
import { code128Widths, qrMatrix } from './barcodes';

// The encoders must give exactly what the full bwip-js gives (its QR sizes match the Labelary emulator).
const texts = ['FTR2026000123', 'A>B_C', '12345678901234567890', 'Örnek Gıda A.Ş.', '{"vkntckn":"1234567890","no":"FTR2026000123","tarih":"2026-11-13","odenecek":"2751.50"}'];

describe('barcode encoders', () => {
  it.each(texts)('Code 128 %s', text => {
    const [raw] = bwipjs.raw('code128', text, 'newencoder suppressc') as Array<{ sbs: number[] }>;
    expect(code128Widths(text)).toEqual(raw.sbs);
  });

  it.each(texts)('QR %s', text => {
    const [raw] = bwipjs.raw('qrcode', text, 'eclevel=Q') as Array<{ pixs: number[]; pixx: number }>;
    expect(qrMatrix(text, 'Q')).toEqual({ pixs: raw.pixs, size: raw.pixx });
  });
});
