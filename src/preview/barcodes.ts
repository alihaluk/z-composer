// Barcode encoding for the preview. Only the two BWIPP encoders the templates use are imported:
// the bwip-js entry point bundles every symbology and is about four times larger.
import { bwipp_code128, bwipp_encode, bwipp_qrcode } from '@bwipp';

type Encoder = typeof bwipp_code128;

// BWIPP returns PostScript arrays (views with `b` and `o`) and Maps; this turns a value into plain data.
function plain(value: unknown): unknown {
  if (Array.isArray(value)) {
    const view = value as unknown[] & { b: unknown[]; o: number };
    return view.b.slice(view.o, view.o + view.length).map(plain);
  }
  return value;
}

function encode(encoder: Encoder, text: string, options: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  // With `dontdraw` BWIPP only encodes, so it needs no graphics context.
  const [result] = bwipp_encode({}, encoder, text, options, true);
  if (!(result instanceof Map)) throw new Error('Barcode could not be encoded');
  return Object.fromEntries(keys.map(k => [k, plain(result.get(k))]));
}

/** Bar and space widths in modules. ^BC without a mode encodes everything in subset B, so subset C is not used. */
export const code128Widths = (text: string): number[] =>
  encode(bwipp_code128, text, { newencoder: true, suppressc: true }, ['sbs']).sbs as number[];

/** Module matrix, row by row. */
export function qrMatrix(text: string, eclevel: string): { pixs: number[]; size: number } {
  const r = encode(bwipp_qrcode, text, { eclevel }, ['pixs', 'pixx']);
  return { pixs: r.pixs as number[], size: r.pixx as number };
}
