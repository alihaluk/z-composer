// Reference filler for ZPL templates (docs/OUTPUT_SPEC.md section 10).
// The designer uses it for previews; it is not part of the deliverable.
import { formatValue, toNumber } from './formats';

type Data = unknown;

interface LineNode { kind: 'line'; text: string; grow?: Record<string, string>; image?: Record<string, string> }
interface IfNode { kind: 'if'; path: string; op: string; body: Node[] }
interface BandNode { kind: 'band'; attrs: Record<string, string>; body: Node[] }
type Node = LineNode | IfNode | BandNode;

const attrs = (s: string): Record<string, string> =>
  Object.fromEntries(s.trim().split(/\s+/).filter(Boolean).map(kv => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));

export function lookup(context: Data, root: Data, path: string): unknown {
  let current: unknown = path.startsWith('$.') ? root : context;
  for (const segment of path.replace(/^\$\./, '').split('.')) {
    // Own properties only: a template must not read `constructor` or anything else inherited.
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export const escapeFieldData = (s: string) => s.replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E');
const escapeBlock = (s: string) => s.replace(/\\/g, '\\\\');
// Static text of a growing field: ^FH escapes decoded, then ^FB backslash escapes.
const decodeStatic = (s: string) =>
  s.replace(/_([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, '$1');

export function evaluateCondition(value: unknown, op: string): boolean {
  if (op === 'notEmpty') return !(value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0));
  if (op === 'notZero') { const n = toNumber(value); return n !== null && n !== 0; }
  return true;
}

/** Resolves one placeholder body (`path|fmt=..|max=..|inv`) to its unescaped text. */
export function resolvePlaceholder(inner: string, context: Data, root: Data, locale: string): string {
  const [path, ...options] = inner.split('|');
  const opts: Record<string, string | true> = {};
  for (const option of options) {
    const i = option.indexOf('=');
    if (i < 0) opts[option] = true; else opts[option.slice(0, i)] = option.slice(i + 1);
  }
  const value = lookup(context, root, path);
  let text = typeof opts.fmt === 'string' ? formatValue(value, opts.fmt, locale, opts.inv === true) : null;
  text ??= value === undefined || value === null || typeof value === 'object' ? '' : String(value);
  if (typeof opts.max === 'string') text = [...text].slice(0, Number(opts.max)).join('');
  // Control characters would break the printed line (docs/OUTPUT_SPEC.md 5.2, step 6).
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ');
}

export function wrapText(text: string, charsPerLine: number, maxLines: number): string[] {
  if (!(charsPerLine >= 1)) throw new Error(`Invalid characters per line: ${charsPerLine}`);
  const lines: string[] = [];
  let current = '';
  for (let word of text.split(' ')) {
    while ([...word].length > charsPerLine) {
      if (current) { lines.push(current); current = ''; }
      lines.push([...word].slice(0, charsPerLine).join(''));
      word = [...word].slice(charsPerLine).join('');
    }
    if (!current) current = word;
    else if ([...current].length + 1 + [...word].length <= charsPerLine) current += ' ' + word;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

/** Whole-number marker attributes (docs/OUTPUT_SPEC.md section 4); a hostile `cpl=0` would never finish wrapping. */
function checkInts(marker: string, values: Record<string, string>, minimums: Record<string, number>) {
  for (const [key, min] of Object.entries(minimums)) {
    const value = values[key];
    if (value === undefined || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min) throw new Error(`Invalid template: ZC:${marker} ${key}=${value}`);
  }
  return values;
}

function parse(lines: string[]): { prologue: string[]; blocks: Node[] } {
  const prologue: string[] = [];
  let i = 0;
  while (i < lines.length && !lines[i].startsWith('^FX ZC:BAND') && !lines[i].startsWith('^FX ZC:IF')) prologue.push(lines[i++]);
  const block = (end: string | null): Node[] => {
    const out: Node[] = [];
    while (i < lines.length) {
      const line = lines[i++];
      if (line === end) return out;
      if (line === '^LH0,0' || line === '^XZ') continue;
      if (line.startsWith('^FX ZC:BAND ')) { const a = checkInts('BAND', attrs(line.slice(11)), { height: 0 }); i++; out.push({ kind: 'band', attrs: a, body: block('^FX ZC:END') }); }
      else if (line.startsWith('^FX ZC:IF ')) { const [path, op] = line.slice(10).trim().split(/\s+/); out.push({ kind: 'if', path, op, body: block('^FX ZC:ENDIF') }); }
      else if (line.startsWith('^FX ZC:GROW ')) out.push({ kind: 'line', text: lines[i++], grow: checkInts('GROW', attrs(line.slice(11)), { cpl: 1, lines: 1, lineHeight: 0 }) });
      else if (line.startsWith('^FX ZC:IMAGE ')) out.push({ kind: 'line', text: lines[i++], image: checkInts('IMAGE', attrs(line.slice(12)), { width: 1, height: 1 }) });
      else if (!line.startsWith('^FX ')) out.push({ kind: 'line', text: line });
    }
    return out;
  };
  return { prologue, blocks: block(null) };
}

/**
 * Splits text around its `{{…}}` placeholders; odd items are the placeholder bodies. Scans once,
 * so that a long line of unclosed `{{` takes linear time, which the equivalent regex does not.
 */
function splitPlaceholders(text: string): string[] {
  const parts: string[] = [];
  let from = 0;
  for (;;) {
    const open = text.indexOf('{{', from);
    const close = open < 0 ? -1 : text.indexOf('}}', open + 2);
    if (close < 0) { parts.push(text.slice(from)); return parts; }
    parts.push(text.slice(from, open), text.slice(open + 2, close));
    from = close + 2;
  }
}

const yOf = (line: string) => Number(/^\^FO\d+,(\d+)/.exec(line)?.[1] ?? 0);

/** Highest specification version this filler understands (docs/OUTPUT_SPEC.md section 13). */
export const SPEC_VERSION = 1;

export interface FillOptions {
  locale: string;
  /** Supplies ^GFA graphic data (without ^FO/^FS) for a dynamic image key. */
  image?: (key: string, width: number, height: number) => string | null;
}

/** Fills a ZPL template with data, following the specification's filling algorithm. */
export function fillTemplate(template: string, root: Data, options: FillOptions): string {
  const { prologue, blocks } = parse(template.split(/\r?\n/).filter(l => l.length > 0));
  const version = Number(/^\^FX ZC:TEMPLATE\b.*\bspec=(\d+)/m.exec(prologue.join('\n'))?.[1] ?? SPEC_VERSION);
  if (version > SPEC_VERSION) throw new Error(`Unsupported template specification version ${version}; this filler supports ${SPEC_VERSION}.`);
  const out = prologue.filter(l => !l.startsWith('^FX '));
  let offset = 0;

  const fillLine = (line: string, ctx: Data) => {
    const code128 = line.includes('^BC');
    const block = line.includes('^FB');
    return splitPlaceholders(line).map((part, i) => {
      if (i % 2 === 0) return part;
      let value = resolvePlaceholder(part, ctx, root, options.locale);
      if (code128) value = value.replace(/>/g, '>0');
      if (block) value = escapeBlock(value);
      return escapeFieldData(value);
    }).join('');
  };

  const content = (nodes: Node[], ctx: Data, acc: { lines: string[]; growY: number; extra: number }) => {
    for (const node of nodes) {
      if (node.kind === 'if') { if (evaluateCondition(lookup(ctx, root, node.path), node.op)) content(node.body, ctx, acc); continue; }
      if (node.kind !== 'line') continue;
      if (node.image) {
        const prefix = /^\^FO\d+,\d+/.exec(node.text)?.[0] ?? '^FO0,0';
        const graphic = options.image?.(node.image.key, Number(node.image.width), Number(node.image.height));
        if (graphic) acc.lines.push(`${prefix}${graphic}^FS`);
      } else if (node.grow) {
        const dataStart = node.text.indexOf('^FD') + 3;
        const dataEnd = node.text.length - 3;
        if (dataStart < 3 || dataStart > dataEnd || !node.text.endsWith('^FS')) { acc.lines.push(fillLine(node.text, ctx)); continue; }
        const text = splitPlaceholders(node.text.slice(dataStart, dataEnd)).map((part, i) => (i % 2 ? resolvePlaceholder(part, ctx, root, options.locale) : decodeStatic(part))).join('');
        const lines = wrapText(text, Number(node.grow.cpl), Number(node.grow.lines));
        acc.lines.push(node.text.slice(0, dataStart) + lines.map(l => escapeFieldData(escapeBlock(l))).join('\\&') + '^FS');
        acc.growY = yOf(node.text);
        acc.extra = Math.max(0, lines.length - 1) * Number(node.grow.lineHeight);
      } else {
        acc.lines.push(fillLine(node.text, ctx));
      }
    }
    return acc;
  };

  const run = (nodes: Node[], ctx: Data) => {
    for (const node of nodes) {
      if (node.kind === 'if') { if (evaluateCondition(lookup(ctx, root, node.path), node.op)) run(node.body, ctx); continue; }
      if (node.kind !== 'band') continue;
      const repeat = node.attrs.repeat;
      const list = repeat ? lookup(ctx, root, repeat) : undefined;
      const items = repeat ? (Array.isArray(list) ? list : []) : [ctx];
      for (const item of items) {
        const r = content(node.body, item, { lines: [], growY: 0, extra: 0 });
        const lines = r.extra > 0
          ? r.lines.map(l => (yOf(l) > r.growY ? l.replace(/^\^FO(\d+),(\d+)/, (_, x, y) => `^FO${x},${Number(y) + r.extra}`) : l))
          : r.lines;
        out.push(`^LH0,${offset}`, ...lines);
        offset += Number(node.attrs.height) + r.extra;
      }
    }
  };

  run(blocks, root);
  out.push('^LH0,0', '^XZ');
  return out.map(l => (l.startsWith('^LL') ? `^LL${Math.max(1, offset)}` : l)).join('\n');
}
