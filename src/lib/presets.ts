// Ready-made templates, each with the catalog it is built on (docs/SCOPE.md).
import { newId } from './templateIO';
import { DEFAULT_CATALOG, type Catalog } from './catalog';
import { GIB_QR_FIELD, GIB_QR_MAGNIFICATION } from './gibQr';
import { ADISYON_CATALOG, DESPATCH_CATALOG, EARSIV_CATALOG, RECEIPT_CATALOG } from './presetCatalogs';
import { type Band, type ContentPart, type Template, type TemplateElement } from '../types';

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

// The GİB guide puts the karekod in the top-right corner of the document (docs/GIB_QR.md).
const QR_SIZE = 22.5;
const QR_X = W - PAD - QR_SIZE;
const LEFT_W = QR_X - PAD - 1;

export interface PresetBandNames {
  header: string; lines: string; vatTitle: string; vatLines: string; totals: string; footer: string; payments: string; signatures: string; discount: string;
}

const ENGLISH_NAMES: PresetBandNames = {
  header: 'Header', lines: 'Lines', vatTitle: 'VAT title', vatLines: 'VAT lines', totals: 'Totals', footer: 'Footer', payments: 'Payments', signatures: 'Signatures', discount: 'Discount',
};

export function invoicePreset(names: PresetBandNames = ENGLISH_NAMES): Template {
  const labelX = PAD;
  const valueX = 14;
  const rightLabelX = 38;
  const rightValueX = 48;

  const header = band(names.header, 64, [
    { id: newId(), type: 'image', x: PAD, y: 1, width: 24, height: 10, imageKey: 'Company.Logo' },
    { id: newId(), type: 'barcode', barcodeType: 'qr', x: QR_X, y: 1, width: QR_SIZE, height: QR_SIZE, magnification: GIB_QR_MAGNIFICATION, isDynamic: true, dataSource: GIB_QR_FIELD },
    text(PAD, 12, LEFT_W, 'e-Fatura', { fontSize: 2.8, height: 3.4 }),
    field(PAD, 16, LEFT_W, 'Company.Name', { fontSize: 3, height: 3.6, fontBold: true, overflow: 'truncate', maxChars: 28 }),
    field(PAD, 20, LEFT_W, 'Company.Address', { overflow: 'wrap', maxLines: 2, height: 6 }),
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

  const lines = band(names.lines, 4.5, [
    field(PAD, 0.8, 33, 'Product.Name', { overflow: 'wrap', maxLines: 3, grow: true }),
    field(36, 0.8, 8, 'Quantity', right),
    field(45, 0.8, 12, 'Price', money),
    field(58, 0.8, 12, 'Total', money),
  ], { repeat: 'Lines' });

  const vatTitle = band(names.vatTitle, 6, [
    line(1),
    text(PAD, 2.5, 30, 'KDV Dökümü', { fontBold: true }),
    text(36, 2.5, 14, 'Matrah', right),
    text(56, 2.5, 14, 'KDV', right),
  ], { condition: { path: 'VatBreakdown', op: 'notEmpty' } });

  const vatLines = band(names.vatLines, 3.6, [
    text(PAD, 0.4, 8, '% KDV'),
    field(10, 0.4, 10, 'Rate'),
    field(30, 0.4, 20, 'Base', money),
    field(52, 0.4, 18, 'Amount', money),
  ], { repeat: 'VatBreakdown' });

  const totals = band(names.totals, 18, [
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

  const footer = band(names.footer, 12, [
    field(PAD, 1, W - 2 * PAD, 'Document.Note', { overflow: 'wrap', maxLines: 2, height: 6, condition: { path: 'Document.Note', op: 'notEmpty' } }),
    text(0, 8, W, 'e-Fatura izni kapsamında elektronik ortamda iletilmiştir.', { align: 'center', fontSize: 2, height: 2.6 }),
  ]);

  return { schemaVersion: 2, printer: { widthMm: W, dpi: 203 }, bands: [header, lines, vatTitle, vatLines, totals, footer] };
}

const small = { fontSize: 2.2, height: 2.8 };
const bold = { fontBold: true };
const date = { format: 'dd.MM.yyyy HH:mm' };
const composed = (x: number, y: number, width: number, parts: ContentPart[], opts: Opts = {}) => text(x, y, width, '', { isDynamic: true, parts, ...opts });
const template = (bands: Band[]): Template => ({ schemaVersion: 2, printer: { widthMm: W, dpi: 203 }, bands });
const qrCode = (): TemplateElement => ({
  id: newId(), type: 'barcode', barcodeType: 'qr', x: QR_X, y: 1, width: QR_SIZE, height: QR_SIZE, magnification: GIB_QR_MAGNIFICATION, isDynamic: true, dataSource: GIB_QR_FIELD,
});
/** Label and value on one row. */
const pair = (y: number, label: string, path: string, valueX = 20, opts: Opts = {}) => [text(PAD, y, valueX - PAD, label), field(valueX, y, W - PAD - valueX, path, opts)];

/** Seller block left of the karekod, which the GİB guide puts in the top-right corner; it ends at 23.5 mm. */
const sellerWithKarekod = (title: string) => [
  qrCode(),
  field(PAD, 1, LEFT_W, 'Company.Name', { fontSize: 3, height: 3.6, ...bold, overflow: 'truncate', maxChars: 28 }),
  field(PAD, 5, LEFT_W, 'Company.Address', { overflow: 'wrap', maxLines: 2, height: 6 }),
  text(PAD, 11.5, 9, 'VKN:'),
  field(11, 11.5, LEFT_W - 9, 'Company.TaxNumber'),
  text(PAD, 14.5, 9, 'V.D.:'),
  field(11, 14.5, LEFT_W - 9, 'Company.TaxOffice', { overflow: 'truncate', maxChars: 20 }),
  text(PAD, 19, LEFT_W, title, { fontSize: 3.2, height: 3.8, ...bold }),
];

/** e-Arşiv invoice to a consumer: two-row lines, totals and karekod. */
export function earsivPreset(names: PresetBandNames = ENGLISH_NAMES): Template {
  const header = band(names.header, 48, [
    ...sellerWithKarekod('e-Arşiv Fatura'),
    line(25),
    ...pair(26.5, 'Fatura No:', 'Document.Number'),
    ...pair(29.5, 'Tarih:', 'Document.Date', 20, date),
    text(PAD, 32.5, 18, 'ETTN:'),
    field(20, 32.5, W - PAD - 20, 'Document.Ettn', small),
    text(PAD, 36.5, 12, 'Sayın', bold),
    field(14, 36.5, W - PAD - 14, 'Customer.Name', { ...bold, overflow: 'truncate', maxChars: 36 }),
    ...pair(39.5, 'TCKN / VKN:', 'Customer.TaxNumber'),
    text(PAD, 43.5, 30, 'Ürün', bold),
    text(46, 43.5, 24, 'Tutar', { ...right, ...bold }),
    line(47),
  ]);
  const lines = band(names.lines, 7.4, [
    field(PAD, 0.5, W - 2 * PAD, 'Product.Name', { overflow: 'wrap', maxLines: 3, grow: true }),
    composed(6, 3.8, 40, [{ path: 'Quantity' }, { text: ' x ' }, { path: 'Price', format: 'N2' }, { text: '   KDV %' }, { path: 'VatRate' }], small),
    field(46, 3.8, 24, 'Total', money),
  ], { repeat: 'Lines' });
  const totals = band(names.totals, 14, [
    line(0.8),
    text(30, 2.2, 20, 'Ara Toplam:'),
    field(50, 2.2, 20, 'Totals.Subtotal', money),
    text(30, 5.2, 20, 'Toplam KDV:'),
    field(50, 5.2, 20, 'Totals.Vat', money),
    text(PAD, 9, 24, 'TOPLAM:', { fontSize: 3.4, height: 4, ...bold }),
    field(30, 9, 40, 'Totals.Grand', { ...money, fontSize: 3.4, height: 4, ...bold }),
  ]);
  const footer = band(names.footer, 11, [
    field(PAD, 1, W - 2 * PAD, 'Document.Note', { overflow: 'wrap', maxLines: 2, height: 6, condition: { path: 'Document.Note', op: 'notEmpty' } }),
    text(0, 7.5, W, 'e-Arşiv izni kapsamında elektronik ortamda iletilmiştir.', { align: 'center', ...small }),
  ]);
  return template([header, lines, totals, footer]);
}

/** Signature boxes for two parties, with an optional name under the first one. */
const signatures = (y: number, left: string, rightTitle: string, leftName?: string) => [
  text(PAD, y, 32, left, { align: 'center', ...bold }),
  text(38, y, 32, rightTitle, { align: 'center', ...bold }),
  ...(leftName ? [field(PAD, y + 3.5, 32, leftName, { align: 'center', overflow: 'truncate', maxChars: 24 })] : []),
  { id: newId(), type: 'box' as const, x: 4, y: y + 10, width: 28, height: 0.25, thickness: 0.25 },
  { id: newId(), type: 'box' as const, x: 40, y: y + 10, width: 28, height: 0.25, thickness: 0.25 },
];

/** e-İrsaliye: receiver, vehicle and driver, goods without prices, delivery signatures. */
export function despatchPreset(names: PresetBandNames = ENGLISH_NAMES): Template {
  const header = band(names.header, 82, [
    ...sellerWithKarekod('e-İrsaliye'),
    line(25),
    ...pair(26.5, 'İrsaliye No:', 'Document.Number'),
    ...pair(29.5, 'Tarih:', 'Document.Date', 20, date),
    text(PAD, 32.5, 18, 'ETTN:'),
    field(20, 32.5, W - PAD - 20, 'Document.Ettn', small),
    text(PAD, 37, 30, 'ALICI', bold),
    field(PAD, 40, W - 2 * PAD, 'Customer.Name', { ...bold, overflow: 'truncate', maxChars: 40 }),
    field(PAD, 43.5, W - 2 * PAD, 'Customer.Address', { overflow: 'wrap', maxLines: 2, height: 6 }),
    text(PAD, 50, 9, 'VKN:'),
    field(11, 50, 25, 'Customer.TaxNumber'),
    text(38, 50, 10, 'V.D.:'),
    field(48, 50, 22, 'Customer.TaxOffice', { overflow: 'truncate', maxChars: 16 }),
    line(54),
    ...pair(55.5, 'Sevk tarihi:', 'Shipment.Date', 22, date),
    ...pair(58.5, 'Plaka:', 'Shipment.Plate', 22),
    ...pair(61.5, 'Şoför:', 'Shipment.Driver', 22),
    text(PAD, 64.5, 20, 'Teslim adresi:'),
    field(22, 64.5, W - PAD - 22, 'Shipment.DeliveryAddress', { overflow: 'wrap', maxLines: 2, height: 6 }),
    text(0, 71.5, W, '*** SEVK İRSALİYESİ ***', { align: 'center', fontSize: 3, height: 3.6, ...bold }),
    text(PAD, 77, 14, 'Kod', bold),
    text(17, 77, 28, 'Ürün', bold),
    text(45, 77, 14, 'Miktar', { ...right, ...bold }),
    text(61, 77, 9, 'Birim', bold),
    line(81),
  ]);
  const lines = band(names.lines, 4.5, [
    field(PAD, 0.8, 14, 'Product.Code', { overflow: 'truncate', maxChars: 10 }),
    field(17, 0.8, 28, 'Product.Name', { overflow: 'wrap', maxLines: 3, grow: true }),
    field(47, 0.8, 12, 'Quantity', right),
    field(61, 0.8, 9, 'Unit', { overflow: 'truncate', maxChars: 6 }),
  ], { repeat: 'Lines' });
  const sign = band(names.signatures, 22, [
    line(0.8),
    field(PAD, 2, W - 2 * PAD, 'Document.Note', { overflow: 'wrap', maxLines: 2, height: 6, condition: { path: 'Document.Note', op: 'notEmpty' } }),
    ...signatures(9, 'Teslim Eden', 'Teslim Alan', 'Shipment.Driver'),
  ]);
  return template([header, lines, sign]);
}

/** Collection receipt: payments by method, total in figures and words, balances, signatures. */
export function receiptPreset(names: PresetBandNames = ENGLISH_NAMES): Template {
  const header = band(names.header, 53, [
    { id: newId(), type: 'image', x: PAD, y: 1, width: 24, height: 10, imageKey: 'Company.Logo' },
    field(PAD, 12, W - 2 * PAD, 'Company.Name', { fontSize: 3, height: 3.6, ...bold, overflow: 'truncate', maxChars: 36 }),
    field(PAD, 16, W - 2 * PAD, 'Company.Address', { overflow: 'wrap', maxLines: 2, height: 6 }),
    text(PAD, 22.5, 9, 'VKN:'),
    field(11, 22.5, 25, 'Company.TaxNumber'),
    text(38, 22.5, 10, 'V.D.:'),
    field(48, 22.5, 22, 'Company.TaxOffice', { overflow: 'truncate', maxChars: 16 }),
    line(26.5),
    text(0, 28, W, 'TAHSİLAT MAKBUZU', { align: 'center', fontSize: 3.4, height: 4, ...bold }),
    ...pair(33.5, 'Makbuz No:', 'Document.Number'),
    ...pair(36.5, 'Tarih:', 'Document.Date', 20, date),
    text(PAD, 41, 12, 'Sayın', bold),
    field(14, 41, W - PAD - 14, 'Customer.Name', { ...bold, overflow: 'truncate', maxChars: 36 }),
    text(PAD, 44, 18, 'Cari kod:'),
    field(20, 44, 18, 'Customer.Code'),
    text(40, 44, 9, 'VKN:'),
    field(49, 44, 21, 'Customer.TaxNumber'),
    text(PAD, 48.5, 30, 'Ödeme', bold),
    text(33, 48.5, 16, 'Vade', bold),
    text(48, 48.5, 22, 'Tutar', { ...right, ...bold }),
    line(52),
  ]);
  // The cheque or card number follows the method on the same row, so a cash payment leaves no gap.
  const payments = band(names.payments, 3.8, [
    composed(PAD, 0.6, 30, [{ path: 'Method', max: 14 }, { text: ' ' }, { path: 'Reference', max: 16 }]),
    field(33, 0.6, 16, 'DueDate', { format: 'dd.MM.yyyy', condition: { path: 'DueDate', op: 'notEmpty' } }),
    field(48, 0.6, 22, 'Amount', money),
  ], { repeat: 'Payments' });
  const totals = band(names.totals, 21, [
    line(0.8),
    text(PAD, 2.5, 36, 'TOPLAM TAHSİLAT:', { fontSize: 3.2, height: 3.8, ...bold }),
    field(40, 2.5, 30, 'Totals.Paid', { ...money, fontSize: 3.2, height: 3.8, ...bold }),
    composed(PAD, 7, W - 2 * PAD, [{ text: 'Yalnız: ' }, { path: 'Totals.PaidInWords' }], { overflow: 'wrap', maxLines: 2, height: 6 }),
    text(28, 13.5, 22, 'Önceki bakiye:'),
    field(50, 13.5, 20, 'Totals.PreviousBalance', money),
    text(28, 16.5, 22, 'Kalan bakiye:', bold),
    field(50, 16.5, 20, 'Totals.Balance', { ...money, ...bold }),
  ]);
  const sign = band(names.signatures, 22, [
    line(0.8),
    composed(PAD, 2, W - 2 * PAD, [{ text: 'Açıklama: ' }, { path: 'Document.Note' }], { overflow: 'wrap', maxLines: 2, height: 6, condition: { path: 'Document.Note', op: 'notEmpty' } }),
    ...signatures(9, 'Tahsil Eden', 'Ödeyen', 'Collector.Name'),
  ]);
  return template([header, payments, totals, sign]);
}

/** e-Adisyon: table and waiter, items with quantities, total and karekod. */
export function adisyonPreset(names: PresetBandNames = ENGLISH_NAMES): Template {
  const header = band(names.header, 48, [
    ...sellerWithKarekod('e-Adisyon'),
    line(25),
    text(PAD, 26.5, 14, 'Masa:', { fontSize: 3.2, height: 3.8, ...bold }),
    field(16, 26.5, 30, 'Order.Table', { fontSize: 3.2, height: 3.8, ...bold, overflow: 'truncate', maxChars: 14 }),
    text(48, 27, 10, 'Kişi:'),
    field(58, 27, 12, 'Order.Guests', right),
    ...pair(31, 'Garson:', 'Order.Waiter', 18),
    ...pair(34, 'Adisyon No:', 'Document.Number', 18),
    ...pair(37, 'Tarih:', 'Document.Date', 18, date),
    text(PAD, 40, 16, 'ETTN:'),
    field(18, 40, W - PAD - 18, 'Document.Ettn', small),
    text(PAD, 44, 8, 'Adet', bold),
    text(11, 44, 36, 'Ürün', bold),
    text(48, 44, 22, 'Tutar', { ...right, ...bold }),
    line(47.5),
  ]);
  const lines = band(names.lines, 4.5, [
    field(PAD, 0.8, 8, 'Quantity'),
    field(11, 0.8, 36, 'Product.Name', { overflow: 'wrap', maxLines: 3, grow: true }),
    field(48, 0.8, 22, 'Total', money),
  ], { repeat: 'Lines' });
  // Subtotal and discount only print with a discount; the band then takes no space at all.
  const discount = band(names.discount, 8, [
    line(0.8),
    text(30, 1.8, 20, 'Ara Toplam:'),
    field(50, 1.8, 20, 'Totals.Subtotal', money),
    text(30, 4.4, 20, 'İndirim:'),
    field(50, 4.4, 20, 'Totals.Discount', money),
  ], { condition: { path: 'Totals.Discount', op: 'notZero' } });
  const totals = band(names.totals, 7.5, [
    line(0.8),
    text(PAD, 2.2, 24, 'TOPLAM:', { fontSize: 3.6, height: 4.2, ...bold }),
    field(30, 2.2, 40, 'Totals.Grand', { ...money, fontSize: 3.6, height: 4.2, ...bold }),
  ]);
  const footer = band(names.footer, 9, [
    text(0, 1, W, 'Afiyet olsun!', { align: 'center', fontSize: 3, height: 3.6, ...bold }),
    text(0, 5, W, 'Bizi tercih ettiğiniz için teşekkür ederiz.', { align: 'center', ...small }),
  ]);
  return template([header, lines, discount, totals, footer]);
}

export type PresetId = 'invoice' | 'earsiv' | 'despatch' | 'receipt' | 'adisyon';

export interface Preset {
  id: PresetId;
  /** The catalog the template binds to, with sample data for the preview. */
  catalog: Catalog;
  build: (names?: PresetBandNames) => Template;
}

export const PRESETS: Preset[] = [
  { id: 'invoice', catalog: DEFAULT_CATALOG, build: invoicePreset },
  { id: 'earsiv', catalog: EARSIV_CATALOG, build: earsivPreset },
  { id: 'despatch', catalog: DESPATCH_CATALOG, build: despatchPreset },
  { id: 'receipt', catalog: RECEIPT_CATALOG, build: receiptPreset },
  { id: 'adisyon', catalog: ADISYON_CATALOG, build: adisyonPreset },
];
