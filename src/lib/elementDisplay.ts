// What an element shows on the design canvas: field names, or sample data
// resolved with the same rules as the filler.
import { type Catalog } from './catalog';
import { evaluateCondition, lookup, resolvePlaceholder } from './zplFill';
import { placeholder } from './zplTemplate';
import { type Band, type TemplateElement } from '../types';
import { type CanvasMode } from '../store/editorStore';

/** Data context of a band in sample mode: the first array item for repeating bands. */
export function sampleContext(catalog: Catalog, band: Band): unknown {
  if (!band.repeat) return catalog.sample;
  const items = lookup(catalog.sample, catalog.sample, band.repeat);
  return Array.isArray(items) ? items[0] : undefined;
}

export function displayText(el: TemplateElement, band: Band, catalog: Catalog, mode: CanvasMode, locale: string): string {
  if (!el.isDynamic || !el.dataSource) {
    const text = el.content ?? '';
    return el.overflow === 'truncate' && el.maxChars ? [...text].slice(0, el.maxChars).join('') : text;
  }
  if (mode === 'fields') return `[${el.dataSource}]`;
  return resolvePlaceholder(placeholder(el).slice(2, -2), sampleContext(catalog, band), catalog.sample, locale);
}

/** In sample mode, whether an element's condition hides it. */
export function hiddenInSample(el: TemplateElement, band: Band, catalog: Catalog, mode: CanvasMode): boolean {
  if (mode !== 'sample' || !el.condition?.path) return false;
  return !evaluateCondition(lookup(sampleContext(catalog, band), catalog.sample, el.condition.path), el.condition.op);
}
