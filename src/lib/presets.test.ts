import { describe, expect, it } from 'vitest';
import { missingFields } from './catalogIO';
import { checkDesign } from './designCheck';
import { GIB_QR_FIELD } from './gibQr';
import { PRESETS } from './presets';
import { parseTemplate } from './templateIO';
import { fillTemplate } from './zplFill';
import { generateTemplateZpl } from './zplTemplate';

const get = (root: unknown, path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], root);

describe.each(PRESETS)('preset $id', preset => {
  const template = preset.build();

  it('binds only fields of its catalog', () => {
    expect(missingFields(template, preset.catalog)).toEqual([]);
  });

  it('passes the design check with every sample row, in Turkish and English cultures', () => {
    expect(checkDesign(template, preset.catalog, 'tr-TR')).toEqual([]);
    expect(checkDesign(template, preset.catalog, 'en-US')).toEqual([]);
  });

  it('is a valid template that fills with its sample', () => {
    expect(() => parseTemplate(JSON.parse(JSON.stringify(template)))).not.toThrow();
    const zpl = fillTemplate(generateTemplateZpl(template), preset.catalog.sample, { locale: 'tr-TR', image: () => null });
    expect(zpl).toMatch(/^\^XA[\s\S]*\^XZ\s*$/);
    expect(zpl).not.toContain('{{');
  });

  it('uses every array of its catalog and fits 72 mm paper', () => {
    const repeats = template.bands.map(b => b.repeat).filter(Boolean);
    const arrays = preset.catalog.fields.filter(f => f.type === 'array').map(f => f.path);
    // The invoice and the e-Arşiv invoice share a catalog; the e-Arşiv layout has no VAT table.
    if (preset.id !== 'earsiv') expect(repeats.sort()).toEqual(arrays.sort());
    expect(template.printer.widthMm).toBe(72);
  });

  it('prints the karekod top-right when its document has one', () => {
    const qr = template.bands[0].elements.find(e => e.barcodeType === 'qr');
    if (preset.id === 'receipt') {
      expect(qr).toBeUndefined();
      return;
    }
    expect(qr).toMatchObject({ dataSource: GIB_QR_FIELD, y: 1 });
    expect(qr!.x + qr!.width).toBeCloseTo(70, 5);
  });
});

describe('sample karekod contents', () => {
  const content = (id: string) => JSON.parse(get(PRESETS.find(p => p.id === id)!.catalog.sample, 'Document.QrContent') as string) as Record<string, string>;
  const sample = (id: string, path: string) => get(PRESETS.find(p => p.id === id)!.catalog.sample, path);

  it('e-Arşiv: consumer scenario, amounts that match the lines', () => {
    const qr = content('earsiv');
    expect(qr).toMatchObject({ senaryo: 'EARSIVFATURA', tip: 'SATIS', no: sample('earsiv', 'Document.Number'), odenecek: '894.48' });
    const lines = sample('earsiv', 'Lines') as { Total: number; Quantity: number; Price: number }[];
    for (const l of lines) expect(l.Quantity * l.Price).toBeCloseTo(l.Total, 2);
    expect(lines.reduce((a, l) => a + l.Total, 0)).toBeCloseTo(Number(qr.malhizmettoplam), 2);
    expect(Number(qr.vergidahil)).toBeCloseTo(sample('earsiv', 'Totals.Grand') as number, 2);
  });

  it('e-İrsaliye: the keys of the guide, section 2.3', () => {
    expect(Object.keys(content('despatch'))).toEqual(['vkntckn', 'avkntckn', 'senaryo', 'tip', 'tarih', 'no', 'ettn', 'sevktarihi', 'sevkzamani', 'plaka']);
    expect(content('despatch')).toMatchObject({ senaryo: 'TEMELIRSALIYE', tip: 'SEVK', no: sample('despatch', 'Document.Number') });
  });

  it('e-Adisyon: the keys of the guide, section 2.8, with the payable amount', () => {
    const qr = content('adisyon');
    expect(qr).toMatchObject({ senaryo: 'EARSIVBELGE', tip: 'ADISYON', 'odenecek(TRY)': '1170.00', no: sample('adisyon', 'Document.Number') });
    const lines = sample('adisyon', 'Lines') as { Total: number; Quantity: number; Price: number }[];
    for (const l of lines) expect(l.Quantity * l.Price).toBe(l.Total);
    expect(lines.reduce((a, l) => a + l.Total, 0)).toBe(sample('adisyon', 'Totals.Grand'));
  });

  it('receipt: payments add up to the total and the balance', () => {
    const payments = sample('receipt', 'Payments') as { Amount: number }[];
    const paid = payments.reduce((a, p) => a + p.Amount, 0);
    expect(paid).toBe(sample('receipt', 'Totals.Paid'));
    expect((sample('receipt', 'Totals.PreviousBalance') as number) - paid).toBeCloseTo(sample('receipt', 'Totals.Balance') as number, 2);
  });
});

describe('adisyon discount', () => {
  const preset = PRESETS.find(p => p.id === 'adisyon')!;
  const fill = (discount: number) => {
    const sample = structuredClone(preset.catalog.sample) as { Totals: { Discount: number; Grand: number } };
    sample.Totals.Discount = discount;
    sample.Totals.Grand -= discount;
    return fillTemplate(generateTemplateZpl(preset.build()), sample, { locale: 'tr-TR', image: () => null });
  };

  it('prints subtotal and discount only when there is a discount', () => {
    expect(fill(0)).not.toContain('Ara Toplam');
    const withDiscount = fill(70);
    expect(withDiscount).toContain('Ara Toplam');
    expect(withDiscount).toContain('70,00');
    expect(withDiscount).toContain('1.100,00');
  });
});
