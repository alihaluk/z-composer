// Generates the ZPL template defined in docs/OUTPUT_SPEC.md from a template model.
import { mmToDots } from './constants';
import { bitmapToZpl } from './imageUtils';
import { A0_AVERAGE_ADVANCE } from '../preview/fontMetrics';
import { type Band, type Condition, type ContentPart, type Dpi, type FieldPart, type Rotation, type Template, type TemplateElement } from '../types';

export const DEFAULT_FONT_MM = 3;
export const DEFAULT_THICKNESS_MM = 0.25;
/** Average character width of the printer font relative to its height (measured). */
const CHAR_WIDTH_RATIO = A0_AVERAGE_ADVANCE;
const LINE_SPACING_RATIO = 0.15;

const ORIENTATION: Record<Rotation, string> = { 0: 'N', 90: 'R', 180: 'I', 270: 'B' };
const JUSTIFY = { left: 'L', center: 'C', right: 'R' } as const;

/** Escapes static field data for ^FH_; `{` is escaped so it never starts a placeholder. */
export const escapeStatic = (s: string) =>
  s.replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E').replace(/\{/g, '_7B');

export const markerId = (id: string) => {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, '');
  return /^[A-Za-z]/.test(clean) ? clean : `b${clean}`;
};

export function placeholder(el: TemplateElement): string {
  return fieldPlaceholder({
    path: el.dataSource ?? '', format: el.format, invariant: el.invariant,
    max: el.type === 'text' && el.overflow === 'truncate' ? el.maxChars : undefined,
  });
}

export function fieldPlaceholder(part: FieldPart): string {
  let body = part.path;
  if (part.format) body += `|fmt=${part.format}`;
  if (part.invariant) body += '|inv';
  if (part.max) body += `|max=${part.max}`;
  return `{{${body}}}`;
}

export const isFieldPart = (part: ContentPart): part is FieldPart => 'path' in part;

/** Whether an element's content is composed of parts. */
export const isComposed = (el: TemplateElement) => !!el.isDynamic && el.parts !== undefined;

/** In ^BC data `>` starts an invocation code; `>0` stands for the character itself. */
export const escapeCode128 = (s: string) => s.replace(/>/g, '>0');

/** In ^FB data `\` starts an escape (`\&` is a line break); `\\` stands for the character itself. */
export const escapeFieldBlock = (s: string) => s.replace(/\\/g, '\\\\');

/** Whether a text element is printed with a ^FB field block. */
export const usesFieldBlock = (el: TemplateElement) => el.type === 'text' && (el.overflow === 'wrap' || (el.align ?? 'left') !== 'left');

/** Field data of static text, escaped for the element's field type. */
function staticData(el: TemplateElement, text: string): string {
  if (el.type === 'barcode' && el.barcodeType !== 'qr') text = escapeCode128(text);
  if (usesFieldBlock(el)) text = escapeFieldBlock(text);
  return escapeStatic(text);
}

function fieldData(el: TemplateElement): string {
  // A composed field may mix static text and placeholders (docs/OUTPUT_SPEC.md 5.1).
  if (isComposed(el)) return (el.parts ?? []).map(p => (!isFieldPart(p) ? staticData(el, p.text) : p.path ? fieldPlaceholder(p) : '')).join('');
  if (el.isDynamic && el.dataSource) return placeholder(el);
  let text = el.content ?? '';
  if (el.type === 'text' && el.overflow === 'truncate' && el.maxChars) text = [...text].slice(0, el.maxChars).join('');
  return staticData(el, text);
}

export interface TextMetrics {
  height: number;
  width: number;
  lineHeight: number;
  charsPerLine: number;
}

export function textMetrics(el: TemplateElement, dpi: Dpi): TextMetrics {
  const height = Math.max(1, mmToDots(el.fontSize ?? DEFAULT_FONT_MM, dpi));
  const width = Math.max(1, mmToDots(el.width, dpi));
  return {
    height,
    width,
    lineHeight: height + Math.round(height * LINE_SPACING_RATIO),
    charsPerLine: el.charsPerLine || Math.max(1, Math.floor(width / (height * CHAR_WIDTH_RATIO))),
  };
}

const ifLines = (condition: Condition | undefined, lines: string[]) =>
  condition?.path ? [`^FX ZC:IF ${condition.path} ${condition.op}`, ...lines, '^FX ZC:ENDIF'] : lines;

/** ZPL lines of one element; coordinates are relative to its band. */
export function elementLines(el: TemplateElement, dpi: Dpi): string[] {
  const d = (mm: number) => mmToDots(mm, dpi);
  const x = d(el.x);
  const y = d(el.y);
  const w = Math.max(1, d(el.width));
  const h = Math.max(1, d(el.height));
  const lines: string[] = [];

  if (el.type === 'text') {
    const m = textMetrics(el, dpi);
    const o = ORIENTATION[el.rotation ?? 0];
    const justify = JUSTIFY[el.align ?? 'left'];
    let block = '';
    if (el.overflow === 'wrap') block = `^FB${m.width},${Math.max(1, el.maxLines ?? 2)},${m.lineHeight - m.height},${justify}`;
    else if (justify !== 'L') block = `^FB${m.width},1,0,${justify}`;
    const field = (fx: number) => `^FO${fx},${y}^A0${o},${m.height},${m.height}${block}^FH_^FD${fieldData(el)}^FS`;
    if (el.overflow === 'wrap' && el.grow) {
      lines.push(`^FX ZC:GROW cpl=${m.charsPerLine} lines=${Math.max(1, el.maxLines ?? 2)} lineHeight=${m.lineHeight}`, field(x));
    } else {
      lines.push(field(x));
      // ^A0 has no bold variant: bold text is printed twice, one dot apart.
      if (el.fontBold) lines.push(field(x + 1));
    }
  } else if (el.type === 'box') {
    const t = Math.max(1, d(el.thickness ?? DEFAULT_THICKNESS_MM));
    lines.push(`^FO${x},${y}^GB${Math.max(w, t)},${Math.max(h, t)},${t}^FS`);
  } else if (el.type === 'barcode') {
    if (el.barcodeType === 'qr') {
      lines.push(`^FO${x},${y}^BQN,2,${Math.max(1, Math.min(10, el.magnification ?? 3))}^FH_^FDQA,${fieldData(el)}^FS`);
    } else {
      const o = ORIENTATION[el.rotation ?? 0];
      lines.push(`^FO${x},${y}^BY${Math.max(1, Math.min(10, el.moduleWidth ?? 2))}^BC${o},${h},${el.showLabel === false ? 'N' : 'Y'},N,N^FH_^FD${fieldData(el)}^FS`);
    }
  } else if (el.type === 'image') {
    if (el.imageKey) {
      lines.push(`^FX ZC:IMAGE key=${el.imageKey} width=${w} height=${h}`, `^FO${x},${y}^GB${w},${h},1^FS`);
    } else if (el.bitmap) {
      const g = bitmapToZpl(el.bitmap, w, h, el.threshold ?? 128);
      lines.push(`^FO${x},${y}^GFA,${g.totalBytes},${g.totalBytes},${g.bytesPerRow},${g.hex}^FS`);
    } else {
      lines.push(`^FO${x},${y}^GB${w},${h},1^FS`);
    }
  }
  return ifLines(el.condition, lines);
}

function bandLines(band: Band, offset: number, dpi: Dpi): string[] {
  const height = Math.max(1, mmToDots(band.height, dpi));
  const head = `^FX ZC:BAND id=${markerId(band.id)} height=${height}${band.repeat ? ` repeat=${band.repeat}` : ''}`;
  const lines = [head, `^LH0,${offset}`, ...band.elements.flatMap(el => elementLines(el, dpi)), '^FX ZC:END'];
  return ifLines(band.condition, lines);
}

export function generateTemplateZpl(template: Template): string {
  const { dpi, widthMm } = template.printer;
  const heights = template.bands.map(b => Math.max(1, mmToDots(b.height, dpi)));
  const total = heights.reduce((a, b) => a + b, 0);
  const lines = ['^XA', `^FX ZC:TEMPLATE spec=1 dpi=${dpi}`, '^CI28', '^MNN', `^PW${mmToDots(widthMm, dpi)}`, `^LL${Math.max(1, total)}`];
  let offset = 0;
  template.bands.forEach((band, i) => {
    lines.push(...bandLines(band, offset, dpi));
    offset += heights[i];
  });
  lines.push('^LH0,0', '^XZ');
  return lines.join('\n');
}
