// Elements made from catalog fields: the field list adds a field to a band as an element bound to it.
import { ROOT_PREFIX, type Catalog, type CatalogField } from './catalog';
import { sampleContext } from './elementDisplay';
import { GIB_QR_FIELD, gibQrPatch } from './gibQr';
import { createElement } from './tools';
import { lookup } from './zplFill';
import { type Band, type TemplateElement } from '../types';

/** A field as the field list offers it: a document field, or an item field of the array `array`. */
export interface FieldRef {
  path: string;
  field: CatalogField;
  array?: string;
}

/** The catalog's scalar fields: document fields first, then the item fields of each array. */
export function fieldRefs(catalog: Catalog): FieldRef[] {
  const refs: FieldRef[] = [];
  for (const f of catalog.fields) if (f.type !== 'array') refs.push({ path: f.path, field: f });
  for (const a of catalog.fields) {
    if (a.type !== 'array') continue;
    for (const f of a.items ?? []) if (f.type !== 'array') refs.push({ path: f.path, field: f, array: a.path });
  }
  return refs;
}

/**
 * The path a band binds the field with, or null when the band cannot print it: item fields belong
 * in a band that repeats their array, and document fields are reached from the root there.
 */
export function bindingPath(ref: FieldRef, band: Band): string | null {
  if (ref.array) return band.repeat === ref.array ? ref.path : null;
  return band.repeat ? ROOT_PREFIX + ref.path : ref.path;
}

/** The band a clicked field goes to: the selected band when it can print the field, else the first one that can. */
export function bandForField(ref: FieldRef, bands: Band[], selectedBandId: string | undefined): Band | undefined {
  const selected = bands.find(b => b.id === selectedBandId);
  return selected && bindingPath(ref, selected) !== null ? selected : bands.find(b => bindingPath(ref, b) !== null);
}

/**
 * An element bound to the field, at (x, y) in the band; null when the band cannot print the field.
 * Numbers are right-aligned with grouping (no decimals when the sample value is whole), dates get a
 * fixed pattern, image fields become dynamic images and the GİB karekod field a karekod QR.
 */
export function createFieldElement(ref: FieldRef, band: Band, x: number, y: number, catalog: Catalog, pageWidthMm: number): TemplateElement | null {
  const path = bindingPath(ref, band);
  if (path === null) return null;
  const { type } = ref.field;

  if (type === 'image') return { ...createElement('image', x, y, pageWidthMm), imageKey: path };
  if (!ref.array && ref.path === GIB_QR_FIELD && type === 'string') {
    const qr = createElement('qr', x, y, pageWidthMm);
    return { ...qr, ...gibQrPatch(qr, band, catalog, pageWidthMm), content: undefined };
  }

  const bound: TemplateElement = { ...createElement('text', x, y, pageWidthMm), content: undefined, isDynamic: true, dataSource: path };
  if (type === 'number') {
    const sample = lookup(sampleContext(catalog, band), catalog.sample, path);
    return { ...bound, align: 'right', format: typeof sample === 'number' && Number.isInteger(sample) ? 'N0' : 'N2' };
  }
  if (type === 'date') return { ...bound, format: 'dd.MM.yyyy' };
  if (type === 'datetime') return { ...bound, format: 'dd.MM.yyyy HH:mm' };
  return bound;
}

const MARGIN_MM = 2;
const GAP_MM = 0.5;

/**
 * Where a clicked field's element goes: below the lowest element of the band, numbers against the
 * right edge. When the band has no room left it falls back to a small offset from the top-left.
 */
export function nextFieldPosition(band: Band, el: TemplateElement, pageWidthMm: number): { x: number; y: number } {
  const bottom = Math.max(0, ...band.elements.map(e => e.y + e.height));
  const y = band.elements.length ? Math.round((bottom + GAP_MM) * 10) / 10 : 1;
  const x = el.align === 'right' ? Math.max(0, pageWidthMm - el.width - MARGIN_MM) : MARGIN_MM;
  if (y + el.height <= band.height) return { x, y };
  const offset = (band.elements.length % 5) * 2;
  return { x: MARGIN_MM + offset, y: 1 + offset };
}

/** Folds text for searching: case, Turkish dotted / dotless i and accents do not matter ("sut" finds "Süt"). */
export const searchFold = (text: string) =>
  text.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Whether the field's label, path or array (`group`, e.g. the array's label) contains the query. */
export const matchesField = (ref: FieldRef, query: string, group = '') => {
  const q = searchFold(query.trim());
  return !q || searchFold(`${ref.field.label ?? ''} ${ref.path} ${ref.array ?? ''} ${group}`).includes(q);
};
