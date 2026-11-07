// Design check: problems a template would show only on paper, found from its layout, the catalog
// and the catalog's sample data.
import { ROOT_PREFIX, findField, type Catalog } from './catalog';
import { dotsPerMm, mmToDots } from './constants';
import { displayText } from './elementDisplay';
import { isComposed, isFieldPart, textMetrics } from './zplTemplate';
import { lookup, wrapText } from './zplFill';
import { A0_AVERAGE_ADVANCE, a0Width, fieldBlockLines } from '../preview/fontMetrics';
import { type Band, type Template, type TemplateElement } from '../types';

export type IssueKind =
  | 'outsidePage' | 'outsideBand' | 'textCut' | 'linesCut' | 'barcodeCut'
  | 'missingField' | 'rootPrefix' | 'noField' | 'emptyContent' | 'noImage';

export interface DesignIssue {
  kind: IssueKind;
  /** Errors lose or spoil printed content; warnings may be intended. */
  severity: 'error' | 'warning';
  bandId: string;
  elementId?: string;
  /** The field path of binding issues. */
  path?: string;
  /** Measured size (mm, or lines for `linesCut`) and the room there is. */
  value?: number;
  limit?: number;
  /** The sample text that does not fit. */
  text?: string;
}

const EPSILON_MM = 0.05;
const round1 = (n: number) => Math.round(n * 10) / 10;

const SEVERITY: Record<IssueKind, DesignIssue['severity']> = {
  outsidePage: 'error', outsideBand: 'warning', textCut: 'error', linesCut: 'warning', barcodeCut: 'error',
  missingField: 'error', rootPrefix: 'error', noField: 'warning', emptyContent: 'warning', noImage: 'warning',
};

/** The catalog with its sample's array `repeat` reduced to one item, so a band can be checked against every row. */
function withItem(catalog: Catalog, repeat: string, item: unknown): Catalog {
  // Only the objects on the array's path are copied; the rest of the sample is shared.
  const set = (node: unknown, keys: string[]): unknown => {
    const copy = { ...(node as Record<string, unknown>) };
    copy[keys[0]] = keys.length === 1 ? [item] : set(copy[keys[0]], keys.slice(1));
    return copy;
  };
  return { ...catalog, sample: set(catalog.sample, repeat.split('.')) };
}

/** The element's text with each sample row of its band (one text outside repeating bands). */
function sampleTexts(el: TemplateElement, band: Band, catalog: Catalog, locale: string): string[] {
  if (!band.repeat || catalog.sample === undefined) return [displayText(el, band, catalog, 'sample', locale)];
  const items = lookup(catalog.sample, catalog.sample, band.repeat);
  if (!Array.isArray(items) || items.length <= 1) return [displayText(el, band, catalog, 'sample', locale)];
  return items.map(item => displayText(el, band, withItem(catalog, band.repeat!, item), 'sample', locale));
}

/** Paths an element or band binds to, with the kind of field each needs. */
type BindingKind = 'value' | 'condition' | 'image' | 'array';

function bindings(el: TemplateElement): { path: string; kind: BindingKind }[] {
  const out: { path: string; kind: BindingKind }[] = [];
  if (el.isDynamic && el.parts) for (const p of el.parts) { if (isFieldPart(p) && p.path) out.push({ path: p.path, kind: 'value' }); }
  else if (el.isDynamic && el.dataSource) out.push({ path: el.dataSource, kind: 'value' });
  if (el.condition?.path) out.push({ path: el.condition.path, kind: 'condition' });
  if (el.type === 'image' && el.imageKey) out.push({ path: el.imageKey, kind: 'image' });
  return out;
}

// A condition may test any field, an array included (printed only when it has items).
const fits = (type: string, kind: BindingKind) =>
  kind === 'array' ? type === 'array' : kind === 'image' ? type === 'image' : kind === 'value' ? type !== 'array' && type !== 'image' : true;

function bindingIssue(catalog: Catalog, band: Band, path: string, kind: BindingKind, elementId?: string): DesignIssue | null {
  const field = findField(catalog, path, kind === 'array' ? undefined : band.repeat);
  if (field && fits(field.type, kind)) return null;
  // In a repeating band a document field is reached with "$.".
  const atRoot = !field && band.repeat && kind !== 'array' && !path.startsWith(ROOT_PREFIX) ? findField(catalog, path) : undefined;
  const issueKind: IssueKind = atRoot && fits(atRoot.type, kind) ? 'rootPrefix' : 'missingField';
  return { kind: issueKind, severity: SEVERITY[issueKind], bandId: band.id, elementId, path };
}

/** How the text of an element prints with the sample data, when some of it is lost. */
function textIssue(el: TemplateElement, band: Band, template: Template, catalog: Catalog, locale: string): DesignIssue | null {
  if (el.type !== 'text' || (el.rotation ?? 0) !== 0) return null;
  const { dpi, widthMm } = template.printer;
  const m = textMetrics(el, dpi);
  const widthOf = (s: string) => a0Width(s, m.height) ?? [...s].length * A0_AVERAGE_ADVANCE * m.height;
  const maxLines = Math.max(1, el.maxLines ?? 2);
  let worst: DesignIssue | null = null;

  for (const text of sampleTexts(el, band, catalog, locale)) {
    if (!text) continue;
    let issue: DesignIssue | null = null;
    if (el.overflow === 'wrap') {
      const lines = el.grow ? wrapText(text, m.charsPerLine, Infinity).length : fieldBlockLines(text, m.width, widthOf).length;
      if (lines > maxLines) issue = { kind: 'linesCut', severity: SEVERITY.linesCut, bandId: band.id, elementId: el.id, value: lines, limit: maxLines, text };
    } else {
      const width = widthOf(text);
      // Left-aligned text runs on past its box and is cut at the paper edge; centred and
      // right-aligned text is laid out in a one-line block of the box width.
      const room = (el.align ?? 'left') === 'left' ? mmToDots(widthMm, dpi) - mmToDots(el.x, dpi) : m.width;
      if (width > room) issue = { kind: 'textCut', severity: SEVERITY.textCut, bandId: band.id, elementId: el.id, value: round1(width / dotsPerMm(dpi)), limit: round1(room / dotsPerMm(dpi)), text };
    }
    if (issue && (!worst || issue.value! > worst.value!)) worst = issue;
  }
  return worst;
}

/**
 * Checks a template. `barcodeWidths` gives the printed width in dots of each barcode element with
 * the sample data (measured by the caller, the encoders load asynchronously).
 */
export function checkDesign(template: Template, catalog: Catalog, locale: string, barcodeWidths: Record<string, number> = {}): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const { widthMm, dpi } = template.printer;
  const add = (issue: DesignIssue | null) => { if (issue) issues.push(issue); };

  for (const band of template.bands) {
    if (band.repeat) add(bindingIssue(catalog, band, band.repeat, 'array'));
    // A band's condition is read from the document, also on a repeating band.
    if (band.condition?.path) add(bindingIssue(catalog, { ...band, repeat: undefined }, band.condition.path, 'condition'));

    for (const el of band.elements) {
      const at = { bandId: band.id, elementId: el.id };
      if (el.x < -EPSILON_MM || el.x + el.width > widthMm + EPSILON_MM) {
        add({ kind: 'outsidePage', severity: SEVERITY.outsidePage, ...at, value: round1(el.x + el.width), limit: widthMm });
      }
      if (el.y + el.height > band.height + EPSILON_MM) {
        add({ kind: 'outsideBand', severity: SEVERITY.outsideBand, ...at, value: round1(el.y + el.height), limit: band.height });
      }
      for (const b of bindings(el)) add(bindingIssue(catalog, band, b.path, b.kind, el.id));

      if (el.isDynamic && (el.type === 'text' || el.type === 'barcode')) {
        // Without a field the static text is printed; composed content without parts prints nothing.
        if (isComposed(el)) {
          if (!(el.parts ?? []).some(p => (isFieldPart(p) ? p.path : p.text))) add({ kind: 'emptyContent', severity: SEVERITY.emptyContent, ...at });
        } else if (!el.dataSource) add({ kind: 'noField', severity: SEVERITY.noField, ...at });
      }
      if (el.type === 'image' && !el.imageKey && !el.bitmap && !el.imageBase64) add({ kind: 'noImage', severity: SEVERITY.noImage, ...at });

      if (catalog.sample !== undefined) add(textIssue(el, band, template, catalog, locale));
      const barcode = barcodeWidths[el.id];
      if (el.type === 'barcode' && barcode !== undefined && mmToDots(el.x, dpi) + barcode > mmToDots(widthMm, dpi)) {
        add({ kind: 'barcodeCut', severity: SEVERITY.barcodeCut, ...at, value: round1(barcode / dotsPerMm(dpi)), limit: round1(widthMm - el.x) });
      }
    }
  }
  return issues;
}

/** The sample text of every barcode element that has one, by element id: what the caller measures for `checkDesign`. */
export function barcodeSamples(template: Template, catalog: Catalog, locale: string): { id: string; kind: 'code128' | 'qr'; text: string; element: TemplateElement }[] {
  const out: ReturnType<typeof barcodeSamples> = [];
  for (const band of template.bands) {
    for (const el of band.elements) {
      if (el.type !== 'barcode') continue;
      // The widest row decides; Code 128 width grows with the text length.
      const text = sampleTexts(el, band, catalog, locale).reduce((a, b) => (b.length > a.length ? b : a), '');
      if (text) out.push({ id: el.id, kind: el.barcodeType === 'qr' ? 'qr' : 'code128', text, element: el });
    }
  }
  return out;
}

/** The element with a document field bound from the root (`$.`), the fix for a `rootPrefix` issue. */
export function withRootPrefix(el: TemplateElement, path: string): Partial<TemplateElement> {
  const fixed = ROOT_PREFIX + path;
  const patch: Partial<TemplateElement> = {};
  if (el.dataSource === path) patch.dataSource = fixed;
  if (el.imageKey === path) patch.imageKey = fixed;
  if (el.condition?.path === path) patch.condition = { ...el.condition, path: fixed };
  if (el.parts?.some(p => isFieldPart(p) && p.path === path)) patch.parts = el.parts.map(p => (isFieldPart(p) && p.path === path ? { ...p, path: fixed } : p));
  return patch;
}
