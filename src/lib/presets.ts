// Ready-made templates built on the default catalog.
import { newId } from './templateIO';
import { type Band, type Template, type TemplateElement } from '../types';

const W = 72;
const PAD = 2;

type Opts = Partial<TemplateElement>;

const text = (x: number, y: number, width: number, content: string, opts: Opts = {}): TemplateElement => ({
  id: newId(), type: 'text', x, y, width, height: (opts.fontSize ?? 2.6) + 0.6, fontSize: 2.6, content, ...opts,
});
const field = (x: number, y: number, width: number, dataSource: string, opts: Opts = {}) =>
  text(x, y, width, '', { isDynamic: true, dataSource, ...opts });
const line = (y: number): TemplateElement => ({ id: newId(), type: 'box', x: PAD, y, width: W - 2 * PAD, height: 0.25, thickness: 0.25 });
const band = (name: string, height: number, elements: TemplateElement[], extra: Partial<Band> = {}): Band => ({ id: newId('b'), name, height, elements, ...extra });

const right = { align: 'right' as const };
const money = { format: 'N2', align: 'right' as const };

export function invoicePreset(): Template {
  const labelX = PAD;
  const valueX = 16;
  const rightLabelX = 38;
  const rightValueX = 48;

  const header = band('Header', 64, [
    { id: newId(), type: 'image', x: (W - 24) / 2, y: 1, width: 24, height: 10, imageKey: 'Company.Logo' },
    text(0, 12, W, 'e-Fatura', { align: 'center', fontSize: 2.8, height: 3.4 }),
    field(PAD, 16, W - 2 * PAD, 'Company.Name', { fontSize: 3, height: 3.6, fontBold: true, overflow: 'truncate', maxChars: 40 }),
    field(PAD, 20, W - 2 * PAD, 'Company.Address', { overflow: 'wrap', maxLines: 2, height: 6 }),
    text(labelX, 26.5, 12, 'Tel:'),
    field(8, 26.5, 28, 'Company.Phone'),
    text(rightLabelX, 26.5, 10, 'VKN:'),
    field(rightValueX, 26.5, 22, 'Company.TaxNumber'),
    text(rightLabelX, 29.5, 10, 'V.D.:'),
    field(rightValueX, 29.5, 22, 'Company.TaxOffice', { overflow: 'truncate', maxChars: 16 }),
    text(labelX, 34, 14, 'Belge No:'),
    field(valueX, 34, 22, 'Document.Number'),
    text(rightLabelX, 34, 10, 'Tarih:'),
    field(rightValueX, 34, 22, 'Document.Date', { format: 'g' }),
    text(labelX, 37, 14, 'Vade:'),
    field(valueX, 37, 22, 'Document.DueDate', { format: 'd' }),
    text(rightLabelX, 37, 10, 'ETTN:'),
    field(rightValueX, 37, 22, 'Document.Ettn', { overflow: 'truncate', maxChars: 13 }),
    text(labelX, 42, 12, 'SAYIN', { fontBold: true }),
    field(14, 42, W - 16, 'Customer.Name', { fontBold: true, overflow: 'truncate', maxChars: 36 }),
    field(PAD, 45, W - 2 * PAD, 'Customer.Address', { overflow: 'wrap', maxLines: 2, height: 6 }),
    text(0, 52, W, '*** SATIŞ FATURASI ***', { align: 'center', fontSize: 3, height: 3.6, fontBold: true }),
    text(PAD, 58, 30, 'Ürün', { fontBold: true }),
    text(36, 58, 8, 'Miktar', { ...right, fontBold: true }),
    text(45, 58, 12, 'Fiyat', { ...right, fontBold: true }),
    text(58, 58, 12, 'Tutar', { ...right, fontBold: true }),
    line(62),
  ]);

  const lines = band('Lines', 4.5, [
    field(PAD, 0.8, 33, 'Product.Name', { overflow: 'wrap', maxLines: 3, grow: true }),
    field(36, 0.8, 8, 'Quantity', right),
    field(45, 0.8, 12, 'Price', money),
    field(58, 0.8, 12, 'Total', money),
  ], { repeat: 'Lines' });

  const vatTitle = band('VAT title', 6, [
    line(1),
    text(PAD, 2.5, 30, 'KDV Dökümü', { fontBold: true }),
    text(36, 2.5, 14, 'Matrah', right),
    text(56, 2.5, 14, 'KDV', right),
  ], { condition: { path: 'VatBreakdown', op: 'notEmpty' } });

  const vatLines = band('VAT lines', 3.6, [
    text(PAD, 0.4, 8, '% KDV'),
    field(10, 0.4, 10, 'Rate'),
    field(30, 0.4, 20, 'Base', money),
    field(52, 0.4, 18, 'Amount', money),
  ], { repeat: 'VatBreakdown' });

  const totals = band('Totals', 18, [
    line(1),
    text(30, 2.5, 22, 'Ara Toplam:'),
    field(50, 2.5, 20, 'Totals.Subtotal', money),
    text(30, 5.5, 22, 'İndirim:', { condition: { path: 'Totals.Discount', op: 'notZero' } }),
    field(50, 5.5, 20, 'Totals.Discount', { ...money, condition: { path: 'Totals.Discount', op: 'notZero' } }),
    text(30, 8.5, 22, 'Toplam KDV:'),
    field(50, 8.5, 20, 'Totals.Vat', money),
    text(26, 12.5, 24, 'GENEL TOPLAM:', { fontSize: 3.2, height: 3.8, fontBold: true }),
    field(48, 12.5, 22, 'Totals.Grand', { ...money, fontSize: 3.2, height: 3.8, fontBold: true }),
  ]);

  const footer = band('Footer', 40, [
    field(PAD, 1, W - 2 * PAD, 'Document.Note', { overflow: 'wrap', maxLines: 2, height: 6, condition: { path: 'Document.Note', op: 'notEmpty' } }),
    { id: newId(), type: 'barcode', barcodeType: 'qr', x: (W - 21) / 2, y: 8, width: 21, height: 21, magnification: 4, isDynamic: true, dataSource: 'Document.QrContent' },
    text(0, 33, W, 'e-Fatura izni kapsamında elektronik ortamda iletilmiştir.', { align: 'center', fontSize: 2, height: 2.6 }),
  ]);

  return { schemaVersion: 2, printer: { widthMm: W, dpi: 203 }, bands: [header, lines, vatTitle, vatLines, totals, footer] };
}
