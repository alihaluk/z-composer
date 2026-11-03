// Draws a parsed ZPL label onto a canvas at printer resolution (1 px = 1 dot).
// Text uses Roboto Condensed Bold as an open substitute for the printer's ^A0
// font (CG Triumvirate Bold Condensed), so text widths are approximate.
import '@fontsource/roboto-condensed/700.css';
import type { Code128Item, GraphicItem, Orientation, QrItem, TextItem, ZplLabel } from './zplParser';

const FONT_FAMILY = '"Roboto Condensed"';
const INK = '#000';

// The part of bwip-js we use; loaded on demand because the library is large.
interface Bwip {
  raw(bcid: string, text: string, options?: Record<string, unknown>): unknown[];
}
let bwipPromise: Promise<Bwip> | null = null;
const loadBwip = () => (bwipPromise ??= import('bwip-js/browser').then(m => (m as unknown as { default: Bwip }).default));

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

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, scaleX: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width * scaleX > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, item: TextItem) {
  const scaleX = item.width / item.height;
  ctx.font = `700 ${item.height}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';

  const { block } = item;
  if (!block) {
    const width = ctx.measureText(item.text).width * scaleX;
    withOrientation(ctx, item.orientation, item.x, item.y, width, item.height, () => {
      ctx.scale(scaleX, 1);
      ctx.fillText(item.text, 0, 0);
    });
    return;
  }

  const lines = item.text.split('\n').flatMap(part => wrapLine(ctx, part, block.width, scaleX));
  const lineHeight = item.height + block.lineSpacing;
  const visible = Math.min(lines.length, block.maxLines);
  withOrientation(ctx, item.orientation, item.x, item.y, block.width, visible * lineHeight, () => {
    lines.forEach((line, i) => {
      // ZPL prints lines beyond the block's maximum over the last line.
      const row = Math.min(i, block.maxLines - 1);
      const width = ctx.measureText(line).width * scaleX;
      const offset = block.justify === 'R' ? block.width - width : block.justify === 'C' ? (block.width - width) / 2 : 0;
      ctx.save();
      ctx.translate(offset, row * lineHeight);
      ctx.scale(scaleX, 1);
      ctx.fillText(line, 0, 0);
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

function drawCode128(ctx: CanvasRenderingContext2D, bwip: Bwip, item: Code128Item) {
  // ^BC without a mode encodes everything in subset B, so subset C must not be used.
  const [encoded] = bwip.raw('code128', item.text, { newencoder: true, suppressc: true }) as Array<{ sbs: number[] }>;
  const modules = encoded.sbs.reduce((sum, w) => sum + w, 0);
  const width = modules * item.moduleWidth;
  const textHeight = item.printText ? Math.max(10, item.moduleWidth * 9) : 0;
  withOrientation(ctx, item.orientation, item.x, item.y, width, item.height + textHeight, () => {
    let x = 0;
    encoded.sbs.forEach((w, i) => {
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

function drawQr(ctx: CanvasRenderingContext2D, bwip: Bwip, item: QrItem) {
  if (!item.text) return;
  const [matrix] = bwip.raw('qrcode', item.text, { eclevel: item.errorCorrection }) as Array<{ pixs: number[]; pixx: number; pixy: number }>;
  const m = item.magnification;
  const top = item.y + QR_TOP_OFFSET;
  for (let row = 0; row < matrix.pixy; row++) {
    for (let col = 0; col < matrix.pixx; col++) {
      if (matrix.pixs[row * matrix.pixx + col]) ctx.fillRect(item.x + col * m, top + row * m, m, m);
    }
  }
}

export async function renderZpl(label: ZplLabel, canvas: HTMLCanvasElement): Promise<void> {
  const needsBarcodes = label.items.some(i => i.kind === 'code128' || i.kind === 'qr');
  const [bwip] = await Promise.all([
    needsBarcodes ? loadBwip() : Promise.resolve(null),
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
        drawCode128(ctx, bwip!, item);
        break;
      case 'qr':
        drawQr(ctx, bwip!, item);
        break;
    }
  }
}
