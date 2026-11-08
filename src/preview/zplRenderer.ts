// Draws a parsed ZPL label onto a canvas at printer resolution (1 px = 1 dot).
// Text uses Roboto Condensed Bold as an open substitute for the printer's ^A0 font
// (CG Triumvirate Bold Condensed), placed with that font's measured widths (fontMetrics.ts).
import '@fontsource/roboto-condensed/latin-700.css';
import '@fontsource/roboto-condensed/latin-ext-700.css';
import { A0_ADVANCE, a0Width, fieldBlockLines } from './fontMetrics';
import type { Code128Item, GraphicItem, Orientation, QrItem, TextItem, ZplLabel } from './zplParser';

const FONT_FAMILY = '"Roboto Condensed"';
const INK = '#000';

// Barcode encoders, loaded on demand.
type Barcodes = typeof import('./barcodes');
let barcodesPromise: Promise<Barcodes> | null = null;
// A failed load is not kept, so a later use can try again.
const loadBarcodes = () => (barcodesPromise ??= import('./barcodes').catch(e => {
  barcodesPromise = null;
  throw e;
}));

// Places content of size w × h (unrotated) so that its rotated bounding box starts at (x, y).
function withOrientation(ctx: CanvasRenderingContext2D, o: Orientation, x: number, y: number, w: number, h: number, draw: () => void) {
  ctx.save();
  if (o === 'R') { ctx.translate(x + h, y); ctx.rotate(Math.PI / 2); }
  else if (o === 'I') { ctx.translate(x + w, y + h); ctx.rotate(Math.PI); }
  else if (o === 'B') { ctx.translate(x, y + w); ctx.rotate(-Math.PI / 2); }
  else ctx.translate(x, y);
  draw();
  ctx.restore();
}

/** Printed width of a text: from the ^A0 width table, or measured with the preview font. */
function textWidth(ctx: CanvasRenderingContext2D, text: string, item: TextItem): number {
  return a0Width(text, item.height, item.width) ?? ctx.measureText(text).width * (item.width / item.height);
}

/**
 * Draws one line starting at (0, 0). With width data for every character, each glyph is
 * centred in the advance the printer gives it, so positions match the printer.
 */
function drawLine(ctx: CanvasRenderingContext2D, text: string, item: TextItem) {
  const scaleX = item.width / item.height;
  if (a0Width(text, item.height, item.width) === null) {
    ctx.save();
    ctx.scale(scaleX, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    return;
  }
  let x = 0;
  for (const c of text) {
    const advance = A0_ADVANCE[c] * item.width;
    const glyph = ctx.measureText(c).width * scaleX;
    ctx.save();
    ctx.translate(x + (advance - glyph) / 2, 0);
    ctx.scale(scaleX, 1);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    x += advance;
  }
}

function drawText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.font = `700 ${item.height}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';

  const { block } = item;
  if (!block) {
    withOrientation(ctx, item.orientation, item.x, item.y, textWidth(ctx, item.text, item), item.height, () => drawLine(ctx, item.text, item));
    return;
  }

  const lines = fieldBlockLines(item.text, block.width, s => textWidth(ctx, s, item));
  const lineHeight = item.height + block.lineSpacing;
  const visible = Math.min(lines.length, block.maxLines);
  withOrientation(ctx, item.orientation, item.x, item.y, block.width, visible * lineHeight, () => {
    lines.forEach((line, i) => {
      // ZPL prints lines beyond the block's maximum over the last line.
      const row = Math.min(i, block.maxLines - 1);
      const width = textWidth(ctx, line, item);
      const offset = block.justify === 'R' ? block.width - width : block.justify === 'C' ? (block.width - width) / 2 : 0;
      ctx.save();
      ctx.translate(offset, row * lineHeight);
      drawLine(ctx, line, item);
      ctx.restore();
    });
  });
}

function drawGraphic(ctx: CanvasRenderingContext2D, item: GraphicItem) {
  const width = item.bytesPerRow * 8;
  const rows = Math.floor(item.data.length / item.bytesPerRow);
  if (!rows) return;
  const image = ctx.getImageData(item.x, item.y, width, rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < width; col++) {
      const byte = item.data[row * item.bytesPerRow + (col >> 3)];
      if (byte & (0x80 >> (col & 7))) {
        const p = (row * width + col) * 4;
        image.data[p] = image.data[p + 1] = image.data[p + 2] = 0;
        image.data[p + 3] = 255;
      }
    }
  }
  ctx.putImageData(image, item.x, item.y);
}

function drawCode128(ctx: CanvasRenderingContext2D, barcodes: Barcodes, item: Code128Item) {
  const sbs = barcodes.code128Widths(item.text);
  const modules = sbs.reduce((sum, w) => sum + w, 0);
  const width = modules * item.moduleWidth;
  const textHeight = item.printText ? code128TextHeight(item.moduleWidth) : 0;
  withOrientation(ctx, item.orientation, item.x, item.y, width, item.height + textHeight, () => {
    let x = 0;
    sbs.forEach((w, i) => {
      if (i % 2 === 0) ctx.fillRect(x, 0, w * item.moduleWidth, item.height);
      x += w * item.moduleWidth;
    });
    if (item.printText) {
      ctx.font = `700 ${textHeight}px ${FONT_FAMILY}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillText(item.text, width / 2, item.height + 2);
      ctx.textAlign = 'left';
    }
  });
}

// Zebra printers start a ^BQ symbol 10 dots below its ^FO position.
const QR_TOP_OFFSET = 10;

function drawQr(ctx: CanvasRenderingContext2D, barcodes: Barcodes, item: QrItem) {
  if (!item.text) return;
  const matrix = barcodes.qrMatrix(item.text, item.errorCorrection);
  const m = item.magnification;
  const top = item.y + QR_TOP_OFFSET;
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.pixs[row * matrix.size + col]) ctx.fillRect(item.x + col * m, top + row * m, m, m);
    }
  }
}

const code128TextHeight = (moduleWidth: number) => Math.max(10, moduleWidth * 9);

/**
 * Printed size in dots of a barcode for some data: Code 128 with its text line, QR including
 * the offset below ^FO. Returns null when the data cannot be encoded.
 */
export async function measureBarcode(
  kind: 'code128' | 'qr', text: string,
  options: { moduleWidth?: number; height?: number; printText?: boolean; magnification?: number },
): Promise<{ width: number; height: number } | null> {
  if (!text) return null;
  const barcodes = await loadBarcodes();
  try {
    if (kind === 'qr') {
      const size = barcodes.qrMatrix(text, 'Q').size * (options.magnification ?? 3);
      return { width: size, height: QR_TOP_OFFSET + size };
    }
    const sbs = barcodes.code128Widths(text);
    const moduleWidth = options.moduleWidth ?? 2;
    const textHeight = options.printText === false ? 0 : code128TextHeight(moduleWidth) + 2;
    return { width: sbs.reduce((a, b) => a + b, 0) * moduleWidth, height: (options.height ?? 0) + textHeight };
  } catch {
    return null;
  }
}

export async function renderZpl(label: ZplLabel, canvas: HTMLCanvasElement): Promise<void> {
  const needsBarcodes = label.items.some(i => i.kind === 'code128' || i.kind === 'qr');
  const [barcodes] = await Promise.all([
    needsBarcodes ? loadBarcodes() : Promise.resolve(null),
    document.fonts.load(`700 20px ${FONT_FAMILY}`, 'AaŞşĞğİı'),
  ]);

  canvas.width = Math.max(1, label.width);
  canvas.height = Math.max(1, label.length);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK;

  for (const item of label.items) {
    switch (item.kind) {
      case 'text':
        drawText(ctx, item);
        break;
      case 'box': {
        const { x, y, width, height, thickness: t } = item;
        if (t * 2 >= Math.min(width, height)) ctx.fillRect(x, y, width, height);
        else {
          ctx.fillRect(x, y, width, t);
          ctx.fillRect(x, y + height - t, width, t);
          ctx.fillRect(x, y, t, height);
          ctx.fillRect(x + width - t, y, t, height);
        }
        break;
      }
      case 'graphic':
        drawGraphic(ctx, item);
        break;
      case 'code128':
        drawCode128(ctx, barcodes!, item);
        break;
      case 'qr':
        drawQr(ctx, barcodes!, item);
        break;
    }
  }
}
