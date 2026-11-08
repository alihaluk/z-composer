// What an element shows on the design canvas: field names, or sample data
// resolved with the same rules as the filler.
import { type Catalog } from './catalog';
import { dotsPerMm } from './constants';
import { evaluateCondition, lookup, resolvePlaceholder, wrapText } from './zplFill';
import { fieldPlaceholder, isComposed, isFieldPart, isGrowing, placeholder, textMetrics } from './zplTemplate';
import { type Band, type Dpi, type TemplateElement } from '../types';
import { type CanvasMode } from '../store/editorStore';

/** Data context of a band in sample mode: the first array item for repeating bands. */
export function sampleContext(catalog: Catalog, band: Band): unknown {
  if (!band.repeat) return catalog.sample;
  const items = lookup(catalog.sample, catalog.sample, band.repeat);
  return Array.isArray(items) ? items[0] : undefined;
}

export function displayText(el: TemplateElement, band: Band, catalog: Catalog, mode: CanvasMode, locale: string): string {
  if (isComposed(el)) {
    return (el.parts ?? []).map(p => {
      if (!isFieldPart(p)) return p.text;
      if (!p.path) return '';
      if (mode === 'fields') return `[${p.path}]`;
      return resolvePlaceholder(fieldPlaceholder(p).slice(2, -2), sampleContext(catalog, band), catalog.sample, locale);
    }).join('');
  }
  if (!el.isDynamic || !el.dataSource) {
    const text = el.content ?? '';
    return el.overflow === 'truncate' && el.maxChars ? [...text].slice(0, el.maxChars).join('') : text;
  }
  if (mode === 'fields') return `[${el.dataSource}]`;
  return resolvePlaceholder(placeholder(el).slice(2, -2), sampleContext(catalog, band), catalog.sample, locale);
}

export interface BandGrowth {
  /** The growing element and its wrapped lines, as the filler would break them. */
  elementId?: string;
  lines?: string[];
  growY: number;
  extraMm: number;
}

/** How much a band grows in sample mode because of its growing text (docs/OUTPUT_SPEC.md section 9). */
export function sampleGrowth(band: Band, catalog: Catalog, mode: CanvasMode, locale: string, dpi: Dpi): BandGrowth {
  const el = band.elements.find(isGrowing);
  if (!el || mode !== 'sample' || hiddenInSample(el, band, catalog, mode)) return { growY: 0, extraMm: 0 };
  const m = textMetrics(el, dpi);
  const lines = wrapText(displayText(el, band, catalog, mode, locale), m.charsPerLine, Math.max(1, el.maxLines ?? 2));
  return { elementId: el.id, lines, growY: el.y, extraMm: (Math.max(0, lines.length - 1) * m.lineHeight) / dotsPerMm(dpi) };
}

/** In sample mode, whether an element's condition hides it. */
export function hiddenInSample(el: TemplateElement, band: Band, catalog: Catalog, mode: CanvasMode): boolean {
  if (mode !== 'sample' || !el.condition?.path) return false;
  return !evaluateCondition(lookup(sampleContext(catalog, band), catalog.sample, el.condition.path), el.condition.op);
}
