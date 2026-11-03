import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, type Catalog } from './catalog';
import { GIB_QR_FIELD, gibQrPatch } from './gibQr';
import { invoicePreset } from './presets';
import { type Band, type TemplateElement } from '../types';

const qr: TemplateElement = { id: 'q', type: 'barcode', barcodeType: 'qr', x: 10, y: 10, width: 15, height: 15, isDynamic: true, parts: [{ text: 'x' }] };
const header: Band = { id: 'h', name: 'H', height: 30, elements: [qr] };

describe('gibQrPatch', () => {
  it('binds the karekod JSON field and places the QR in the top-right corner', () => {
    expect(gibQrPatch(qr, header, DEFAULT_CATALOG, 72)).toMatchObject({
      isDynamic: true, parts: undefined, dataSource: GIB_QR_FIELD, magnification: 2, width: 22.5, height: 22.5, x: 47.5, y: 1,
    });
  });

  it('reaches the document field from a repeating band', () => {
    expect(gibQrPatch(qr, { ...header, repeat: 'Lines' }, DEFAULT_CATALOG, 72).dataSource).toBe(`$.${GIB_QR_FIELD}`);
  });

  it('keeps the current field when the catalog has no karekod field', () => {
    const catalog: Catalog = { catalogVersion: 1, name: 'x', fields: [] };
    expect(gibQrPatch({ ...qr, dataSource: 'Mine' }, header, catalog, 72).dataSource).toBe('Mine');
  });
});

describe('sample karekod content', () => {
  const sample = DEFAULT_CATALOG.sample as { Document: { QrContent: string; Number: string }; Totals: Record<string, number>; VatBreakdown: { Rate: number; Base: number; Amount: number }[] };
  const qrJson = JSON.parse(sample.Document.QrContent) as Record<string, string>;

  it('has the e-Fatura keys of the GİB guide, matching the sample totals', () => {
    expect(Object.keys(qrJson)).toEqual(['vkntckn', 'avkntckn', 'senaryo', 'tip', 'tarih', 'no', 'ettn', 'parabirimi', 'malhizmettoplam',
      'kdvmatrah(1)', 'hesaplanankdv(1)', 'kdvmatrah(20)', 'hesaplanankdv(20)', 'vergidahil', 'odenecek']);
    expect(qrJson.no).toBe(sample.Document.Number);
    expect(qrJson.no).toMatch(/^[A-Z0-9]{3}\d{4}\d{9}$/);
    expect(qrJson.malhizmettoplam).toBe(sample.Totals.Subtotal.toFixed(2));
    expect(qrJson.odenecek).toBe(sample.Totals.Grand.toFixed(2));
    for (const v of sample.VatBreakdown) {
      expect(qrJson[`kdvmatrah(${v.Rate})`]).toBe(v.Base.toFixed(2));
      expect(qrJson[`hesaplanankdv(${v.Rate})`]).toBe(v.Amount.toFixed(2));
    }
  });

  it('is placed by the invoice preset like the GİB guide asks', () => {
    const el = invoicePreset().bands[0].elements.find(e => e.barcodeType === 'qr')!;
    expect(el).toMatchObject({ dataSource: GIB_QR_FIELD, y: 1 });
    expect(el.x + el.width).toBe(70);
  });
});
