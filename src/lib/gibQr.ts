// GİB e-Fatura / e-Arşiv karekod (docs/GIB_QR.md). The JSON content is produced by the firm's own
// system from its UBL data; the preset binds a QR element to it and places it as the guide asks.
import { findField, type Catalog } from './catalog';
import { type Band, type TemplateElement } from '../types';

/** Catalog field that holds the karekod JSON in the default catalog. */
export const GIB_QR_FIELD = 'Document.QrContent';

/** 2 dots per module: a full e-Fatura JSON (about 370 characters, 89 modules at level Q) is about 22 mm at 203 dpi. */
export const GIB_QR_MAGNIFICATION = 2;
const GIB_QR_SIZE_MM = 22.5;
const MARGIN_MM = 2;

/** Settings that make a QR element the GİB karekod: bound to the JSON field, at the top-right corner of its band. */
export function gibQrPatch(el: TemplateElement, band: Band, catalog: Catalog, pageWidthMm: number): Partial<TemplateElement> {
  // Inside a repeating band the document field is reached from the root.
  const path = band.repeat ? `$.${GIB_QR_FIELD}` : GIB_QR_FIELD;
  const known = findField(catalog, path, band.repeat)?.type === 'string';
  const size = Math.max(el.width, GIB_QR_SIZE_MM);
  return {
    isDynamic: true, parts: undefined, format: undefined, invariant: undefined,
    dataSource: known ? path : el.dataSource,
    magnification: GIB_QR_MAGNIFICATION,
    width: size, height: size,
    x: Math.max(0, pageWidthMm - size - MARGIN_MM), y: MARGIN_MM / 2,
  };
}
