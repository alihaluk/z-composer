// Building, validating and loading field catalogs (docs/SCOPE.md D2).
import { findField, ROOT_PREFIX, type Catalog, type CatalogField, type FieldType } from './catalog';
import { type Template } from '../types';

/** One path segment of docs/OUTPUT_SPEC.md section 5: a letter or `_`, then letters, digits or `_`. */
const SEGMENT = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const FIELD_TYPES: FieldType[] = ['string', 'number', 'date', 'datetime', 'boolean', 'image', 'array'];

export const isValidPath = (path: string) => {
  const bare = path.startsWith(ROOT_PREFIX) ? path.slice(ROOT_PREFIX.length) : path;
  return bare.length > 0 && bare.split('.').every(s => SEGMENT.test(s));
};

export interface CatalogResult {
  catalog: Catalog;
  /** Keys that could not become fields, with the reason. */
  skipped: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function scalarType(value: unknown): FieldType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime';
    if (/^data:image\//.test(value)) return 'image';
  }
  return 'string';
}

function fieldsFromObject(obj: Record<string, unknown>, prefix: string, skipped: string[], inArray: boolean): CatalogField[] {
  const fields: CatalogField[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!SEGMENT.test(key)) { skipped.push(`${path}: name`); continue; }
    if (isObject(value)) fields.push(...fieldsFromObject(value, path, skipped, inArray));
    else if (Array.isArray(value)) {
      const objects = value.filter(isObject);
      if (inArray) skipped.push(`${path}: nested array`);
      else if (objects.length === 0) skipped.push(`${path}: array of values`);
      else {
        // Items are merged so that a key present in any item becomes a field.
        const merged = objects.reduce<Record<string, unknown>>((acc, item) => ({ ...item, ...acc }), {});
        fields.push({ path, type: 'array', items: fieldsFromObject(merged, '', skipped, true) });
      }
    } else fields.push({ path, type: scalarType(value) });
  }
  return fields;
}

/** Infers a catalog from one example document; the document becomes the sample data. */
export function catalogFromSample(sample: unknown, name: string): CatalogResult {
  if (!isObject(sample)) throw new Error('The sample must be a JSON object');
  const skipped: string[] = [];
  return { catalog: { catalogVersion: 1, name, fields: fieldsFromObject(sample, '', skipped, false), sample }, skipped };
}

type Schema = Record<string, unknown>;

function resolveRef(schema: Schema, root: Schema): Schema {
  const ref = schema.$ref;
  if (typeof ref !== 'string') return schema;
  const parts = ref.replace(/^#\//, '').split('/');
  let target: unknown = root;
  for (const part of parts) target = isObject(target) ? target[part] : undefined;
  if (!isObject(target)) throw new Error(`Unresolved reference ${ref}`);
  return resolveRef(target, root);
}

/**
 * Unwraps the shapes generators use around a property: a single `allOf` entry, and `oneOf` /
 * `anyOf` with a null alternative (how .NET and Java tools write nullable references).
 */
function unwrap(raw: Schema, root: Schema): Schema {
  let s = resolveRef(raw, root);
  for (let i = 0; i < 4; i++) {
    const options = [s.allOf, s.oneOf, s.anyOf].find(Array.isArray) as unknown[] | undefined;
    if (!options || s.properties || s.type) break;
    const nonNull = options.filter(isObject).map(o => resolveRef(o, root)).filter(o => o.type !== 'null');
    if (nonNull.length !== 1) break;
    s = { ...nonNull[0], title: s.title ?? nonNull[0].title };
  }
  return s;
}

function schemaType(s: Schema): string | undefined {
  const type = Array.isArray(s.type) ? s.type.find(t => t !== 'null') : s.type;
  if (typeof type === 'string') return type;
  if (isObject(s.properties)) return 'object';
  return undefined;
}

function fieldsFromSchema(schema: Schema, root: Schema, prefix: string, skipped: string[], inArray: boolean, depth: number): CatalogField[] {
  if (depth > 8) { skipped.push(`${prefix}: too deep`); return []; }
  const props = isObject(schema.properties) ? schema.properties : {};
  const fields: CatalogField[] = [];
  for (const [key, raw] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!SEGMENT.test(key)) { skipped.push(`${path}: name`); continue; }
    if (!isObject(raw)) continue;
    const s = unwrap(raw, root);
    const label = typeof s.title === 'string' ? s.title : typeof raw.description === 'string' ? raw.description : undefined;
    const type = schemaType(s);
    if (type === 'object') fields.push(...fieldsFromSchema(s, root, path, skipped, inArray, depth + 1));
    else if (type === 'array') {
      const items = isObject(s.items) ? unwrap(s.items, root) : undefined;
      if (inArray) skipped.push(`${path}: nested array`);
      else if (!items || schemaType(items) !== 'object') skipped.push(`${path}: array of values`);
      else fields.push({ path, type: 'array', label, items: fieldsFromSchema(items, root, '', skipped, true, depth + 1) });
    } else {
      const fieldType: FieldType = type === 'number' || type === 'integer' ? 'number'
        : type === 'boolean' ? 'boolean'
          : s.format === 'date' ? 'date'
            : s.format === 'date-time' ? 'datetime'
              : 'string';
      fields.push(label ? { path, type: fieldType, label } : { path, type: fieldType });
    }
  }
  return fields;
}

/** Builds a catalog from a JSON Schema (draft 7 or 2020-12, local $refs); sample data is generated. */
export function catalogFromJsonSchema(schema: unknown, name: string): CatalogResult {
  if (!isObject(schema)) throw new Error('The schema must be a JSON object');
  const skipped: string[] = [];
  const root = resolveRef(schema, schema);
  const fields = fieldsFromSchema(root, schema, '', skipped, false, 0);
  if (fields.length === 0) throw new Error('The schema has no properties');
  const catalog: Catalog = { catalogVersion: 1, name: typeof schema.title === 'string' ? schema.title : name, fields };
  return { catalog: { ...catalog, sample: sampleFromCatalog(catalog) }, skipped };
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.');
  let cur = target;
  for (const s of segments.slice(0, -1)) cur = (cur[s] ??= {}) as Record<string, unknown>;
  cur[segments[segments.length - 1]] = value;
}

const SAMPLE_VALUES: Record<FieldType, (path: string, i: number) => unknown> = {
  string: (path, i) => `${path.split('.').pop()}${i > 0 ? ` ${i + 1}` : ''}`,
  number: (_, i) => 1234.5 * (i + 1),
  date: () => '2026-11-13',
  datetime: () => '2026-11-13T14:37:00',
  boolean: () => true,
  image: () => undefined,
  array: () => [],
};

/** Placeholder data for catalogs without a sample: field names, round numbers, a fixed date. */
export function sampleFromCatalog(catalog: Catalog): Record<string, unknown> {
  const build = (fields: CatalogField[], i: number) => {
    const obj: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'array') setPath(obj, f.path, [0, 1].map(n => build(f.items ?? [], n)));
      else setPath(obj, f.path, SAMPLE_VALUES[f.type](f.path, i));
    }
    return obj;
  };
  return build(catalog.fields, 0);
}

function validateFields(fields: unknown, where: string, allowArrays: boolean): CatalogField[] {
  if (!Array.isArray(fields)) throw new Error(`${where}: fields must be an array`);
  return fields.map((f, i) => {
    if (!isObject(f) || typeof f.path !== 'string' || !isValidPath(f.path) || f.path.startsWith(ROOT_PREFIX)) {
      throw new Error(`${where}: field ${i} has an invalid path`);
    }
    if (!FIELD_TYPES.includes(f.type as FieldType)) throw new Error(`${where}: ${f.path} has an unknown type`);
    if (f.type === 'array' && !allowArrays) throw new Error(`${where}: ${f.path}: arrays cannot be nested`);
    const field: CatalogField = { path: f.path, type: f.type as FieldType };
    if (typeof f.label === 'string' && f.label) field.label = f.label;
    if (f.type === 'array') field.items = validateFields(f.items ?? [], `${where} ${f.path}`, false);
    return field;
  });
}

/** Validates a catalog file. */
export function parseCatalog(json: unknown): Catalog {
  if (!isObject(json) || json.catalogVersion !== 1) throw new Error('Not a Z-Composer catalog (catalogVersion 1)');
  return {
    catalogVersion: 1,
    name: typeof json.name === 'string' ? json.name : 'Catalog',
    fields: validateFields(json.fields, 'catalog', true),
    ...(json.sample !== undefined ? { sample: json.sample } : {}),
  };
}

/** Every binding of a template: field paths with the band context they are used in. */
export function templateBindings(template: Template): { path: string; repeat?: string; kind: 'field' | 'condition' | 'image' | 'repeat' }[] {
  const out: ReturnType<typeof templateBindings> = [];
  for (const band of template.bands) {
    if (band.repeat) out.push({ path: band.repeat, kind: 'repeat' });
    if (band.condition?.path) out.push({ path: band.condition.path, kind: 'condition' });
    for (const el of band.elements) {
      if (el.isDynamic && el.dataSource) out.push({ path: el.dataSource, repeat: band.repeat, kind: 'field' });
      if (el.condition?.path) out.push({ path: el.condition.path, repeat: band.repeat, kind: 'condition' });
      if (el.type === 'image' && el.imageKey) out.push({ path: el.imageKey, repeat: band.repeat, kind: 'image' });
    }
  }
  return out;
}

/** Bindings of a template that the catalog does not provide, as unique paths. */
export function missingFields(template: Template, catalog: Catalog): string[] {
  const missing = templateBindings(template).filter(b => {
    const field = findField(catalog, b.path, b.kind === 'repeat' ? undefined : b.repeat);
    if (!field) return true;
    if (b.kind === 'repeat') return field.type !== 'array';
    if (b.kind === 'image') return field.type !== 'image';
    return false;
  });
  return [...new Set(missing.map(b => b.path))];
}

/** The fields a template uses with their catalog types, stored in the template (docs/SCOPE.md D2). */
export function fieldsUsed(template: Template, catalog: Catalog): { path: string; type: string }[] {
  const seen = new Map<string, string>();
  for (const b of templateBindings(template)) {
    const key = b.repeat && !b.path.startsWith(ROOT_PREFIX) && b.kind !== 'repeat' ? `${b.repeat}[].${b.path}` : b.path.replace(ROOT_PREFIX, '');
    seen.set(key, findField(catalog, b.path, b.kind === 'repeat' ? undefined : b.repeat)?.type ?? 'unknown');
  }
  return [...seen].map(([path, type]) => ({ path, type }));
}

/** Fields whose catalog type differs from the type recorded when the template was saved. */
export function changedFields(template: Template, catalog: Catalog): { path: string; was: string; now: string }[] {
  if (!template.fieldsUsed?.length) return [];
  const current = new Map(fieldsUsed(template, catalog).map(f => [f.path, f.type]));
  return template.fieldsUsed
    .filter(f => current.has(f.path) && current.get(f.path) !== 'unknown' && current.get(f.path) !== f.type)
    .map(f => ({ path: f.path, was: f.type, now: current.get(f.path)! }));
}
