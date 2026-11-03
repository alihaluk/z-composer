// Parses the ZPL subset that Z-Composer emits (docs/OUTPUT_SPEC.md) into
// positioned items in printer dots. Unsupported commands are ignored.

export type Orientation = 'N' | 'R' | 'I' | 'B';
export type Justify = 'L' | 'C' | 'R' | 'J';

export interface FieldBlock {
  width: number;
  maxLines: number;
  lineSpacing: number;
  justify: Justify;
}

export interface TextItem {
  kind: 'text';
  x: number;
  y: number;
  height: number;
  width: number;
  orientation: Orientation;
  text: string;
  block?: FieldBlock;
}

export interface BoxItem {
  kind: 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
}

export interface GraphicItem {
  kind: 'graphic';
  x: number;
  y: number;
  bytesPerRow: number;
  data: Uint8Array;
}

export interface Code128Item {
  kind: 'code128';
  x: number;
  y: number;
  height: number;
  moduleWidth: number;
  orientation: Orientation;
  printText: boolean;
  text: string;
}

export interface QrItem {
  kind: 'qr';
  x: number;
  y: number;
  magnification: number;
  errorCorrection: 'H' | 'Q' | 'M' | 'L';
  text: string;
}

export type ZplItem = TextItem | BoxItem | GraphicItem | Code128Item | QrItem;

export interface ZplLabel {
  width: number;
  length: number;
  items: ZplItem[];
}

const DEFAULT_FONT = { height: 9, width: 5 };

const int = (value: string | undefined, fallback: number): number => {
  const n = parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
};

const orientation = (value: string | undefined): Orientation =>
  value === 'R' || value === 'I' || value === 'B' ? value : 'N';

// Decodes ^FH escapes (indicator + two hex digits) as UTF-8 bytes (^CI28).
export const decodeFieldData = (data: string, indicator?: string): string => {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let i = 0; i < data.length; i++) {
    const hex = data.slice(i + 1, i + 3);
    if (indicator && data[i] === indicator && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      const codePoint = data.codePointAt(i)!;
      const char = String.fromCodePoint(codePoint);
      bytes.push(...encoder.encode(char));
      i += char.length - 1;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
};

/**
 * ^BC treats `>` plus one character as an invocation code: `>0` is a literal `>`,
 * the others select code sets or functions and print nothing themselves.
 */
export const decodeCode128Invocations = (data: string): string => data.replace(/>(.?)/g, (_, c: string) => (c === '0' ? '>' : ''));

/** ^FB reads `\&` as a line break (returned as `\n`) and `\x` as `x`, so `\\` is a backslash. */
export const decodeFieldBlock = (data: string): string => data.replace(/\\(.?)/g, (_, c: string) => (c === '&' ? '\n' : c));

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

export function parseZpl(zpl: string): ZplLabel {
  const label: ZplLabel = { width: 0, length: 0, items: [] };
  const home = { x: 0, y: 0 };
  const barcodeDefaults = { moduleWidth: 2, height: 10 };

  // Field state, reset at every ^FS.
  let origin = { x: 0, y: 0 };
  let font: { height: number; width: number; orientation: Orientation } | null = null;
  let block: FieldBlock | undefined;
  let hexIndicator: string | undefined;
  let barcode: { type: 'code128'; orientation: Orientation; height: number; printText: boolean } | { type: 'qr'; magnification: number } | null = null;
  let data: string | null = null;

  const resetField = () => {
    font = null;
    block = undefined;
    hexIndicator = undefined;
    barcode = null;
    data = null;
  };

  const flushField = () => {
    if (data !== null) {
      const text = decodeFieldData(data, hexIndicator);
      if (barcode?.type === 'code128') {
        label.items.push({ kind: 'code128', ...origin, height: barcode.height, moduleWidth: barcodeDefaults.moduleWidth, orientation: barcode.orientation, printText: barcode.printText, text: decodeCode128Invocations(text) });
      } else if (barcode?.type === 'qr') {
        const match = /^([HQML])[AM],/.exec(text);
        label.items.push({ kind: 'qr', ...origin, magnification: barcode.magnification, errorCorrection: (match?.[1] ?? 'Q') as QrItem['errorCorrection'], text: match ? text.slice(3) : text });
      } else {
        const f = font ?? { ...DEFAULT_FONT, orientation: 'N' as Orientation };
        label.items.push({ kind: 'text', ...origin, height: f.height, width: f.width, orientation: f.orientation, text: block ? decodeFieldBlock(text) : text, block });
      }
    }
    resetField();
  };

  for (const token of zpl.split('^').slice(1)) {
    const code = token.slice(0, 2).toUpperCase();

    if (code === 'FD') {
      data = token.slice(2).replace(/[\r\n]/g, '');
      continue;
    }
    if (code === 'FX') continue;

    const params = token.replace(/[\r\n]/g, '');

    if (params[0]?.toUpperCase() === 'A' && code !== 'A@') {
      // ^Afo,h,w — the font name is the character right after A.
      const [o, h, w] = params.slice(2).split(',');
      const height = int(h, DEFAULT_FONT.height);
      font = { orientation: orientation(o), height, width: int(w, height) };
      continue;
    }

    const args = params.slice(2).split(',');
    switch (code) {
      case 'XA':
        resetField();
        break;
      case 'PW':
        label.width = int(args[0], label.width);
        break;
      case 'LL':
        label.length = int(args[0], label.length);
        break;
      case 'LH':
        home.x = int(args[0], 0);
        home.y = int(args[1], 0);
        break;
      case 'FO':
        origin = { x: home.x + int(args[0], 0), y: home.y + int(args[1], 0) };
        break;
      case 'FH':
        hexIndicator = args[0] || '_';
        break;
      case 'FB':
        block = { width: int(args[0], 0), maxLines: int(args[1], 1), lineSpacing: int(args[2], 0), justify: (['L', 'C', 'R', 'J'].includes(args[3]) ? args[3] : 'L') as Justify };
        break;
      case 'BY':
        barcodeDefaults.moduleWidth = int(args[0], 2);
        barcodeDefaults.height = int(args[2], barcodeDefaults.height);
        break;
      case 'BC':
        barcode = { type: 'code128', orientation: orientation(args[0]), height: int(args[1], barcodeDefaults.height), printText: args[2] !== 'N' };
        break;
      case 'BQ':
        barcode = { type: 'qr', magnification: int(args[2], 3) };
        break;
      case 'GB': {
        const thickness = int(args[2], 1);
        label.items.push({ kind: 'box', ...origin, width: Math.max(int(args[0], thickness), thickness), height: Math.max(int(args[1], thickness), thickness), thickness });
        break;
      }
      case 'GF': {
        // ^GFA,total,total,bytesPerRow,data — ASCII hex without compression.
        const [, , , bytesPerRow, ...rest] = args;
        label.items.push({ kind: 'graphic', ...origin, bytesPerRow: int(bytesPerRow, 1), data: hexToBytes(rest.join(',')) });
        break;
      }
      case 'FS':
        flushField();
        break;
    }
  }

  return label;
}
