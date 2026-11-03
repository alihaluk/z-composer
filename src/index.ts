// Library entry: the embeddable designer and the template / catalog tools around it.
import './lib.css';

export { ZComposer, type ZComposerProps, type ZComposerSaveResult } from './ZComposer';
export type { Language } from './i18n';
export type * from './types';

export { DEFAULT_CATALOG, type Catalog, type CatalogField, type FieldType } from './lib/catalog';
export { catalogFromJsonSchema, catalogFromSample, missingFields, parseCatalog, sampleFromCatalog } from './lib/catalogIO';
export { emptyTemplate, parseTemplate, withFieldsUsed } from './lib/templateIO';
export { invoicePreset } from './lib/presets';
export { generateTemplateZpl } from './lib/zplTemplate';
export { fillTemplate, type FillOptions } from './lib/zplFill';
