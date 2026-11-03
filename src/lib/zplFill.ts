// Reference filler for ZPL templates (docs/OUTPUT_SPEC.md section 10).
// The designer uses it for previews; it is not part of the deliverable.
import { formatValue } from './formats';

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
    if (current === null || typeof current !== 'object') return undefined;
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
  if (op === 'notZero') {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : null;
    return n !== null && n !== 0;
  }
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
      if (line.startsWith('^FX ZC:BAND ')) { const a = attrs(line.slice(11)); i++; out.push({ kind: 'band', attrs: a, body: block('^FX ZC:END') }); }
      else if (line.startsWith('^FX ZC:IF ')) { const [path, op] = line.slice(10).trim().split(/\s+/); out.push({ kind: 'if', path, op, body: block('^FX ZC:ENDIF') }); }
      else if (line.startsWith('^FX ZC:GROW ')) out.push({ kind: 'line', text: lines[i++], grow: attrs(line.slice(11)) });
      else if (line.startsWith('^FX ZC:IMAGE ')) out.push({ kind: 'line', text: lines[i++], image: attrs(line.slice(12)) });
      else if (!line.startsWith('^FX ')) out.push({ kind: 'line', text: line });
    }
    return out;
  };
  return { prologue, blocks: block(null) };
}

const yOf = (line: string) => Number(/^\^FO\d+,(\d+)/.exec(line)?.[1] ?? 0);

export interface FillOptions {
  locale: string;
  /** Supplies ^GFA graphic data (without ^FO/^FS) for a dynamic image key. */
  image?: (key: string, width: number, height: number) => string | null;
}

/** Fills a ZPL template with data, following the specification's filling algorithm. */
export function fillTemplate(template: string, root: Data, options: FillOptions): string {
  const { prologue, blocks } = parse(template.split(/\r?\n/).filter(l => l.length > 0));
  const out = prologue.filter(l => !l.startsWith('^FX '));
  let offset = 0;

  const fillLine = (line: string, ctx: Data) => {
    const code128 = line.includes('^BC');
    const block = line.includes('^FB');
    return line.replace(/\{\{(.*?)\}\}/g, (_, inner: string) => {
      let value = resolvePlaceholder(inner, ctx, root, options.locale);
      if (code128) value = value.replace(/>/g, '>0');
      if (block) value = escapeBlock(value);
      return escapeFieldData(value);
    });
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
        const m = /^(.*?\^FD)(.*)(\^FS)$/.exec(node.text);
        if (!m) { acc.lines.push(fillLine(node.text, ctx)); continue; }
        const text = m[2].split(/(\{\{.*?\}\})/).map(part => part.startsWith('{{') ? resolvePlaceholder(part.slice(2, -2), ctx, root, options.locale) : decodeStatic(part)).join('');
        const lines = wrapText(text, Number(node.grow.cpl), Number(node.grow.lines));
        acc.lines.push(m[1] + lines.map(l => escapeFieldData(escapeBlock(l))).join('\\&') + m[3]);
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
