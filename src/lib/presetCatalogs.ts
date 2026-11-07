// Catalogs of the ready-made templates other than the invoice, each with sample data that is
// consistent (line totals, VAT, karekod content) so the preview and the design check are meaningful.
// Karekod contents follow the GİB Karekod Standardı Kılavuzu 1.1 (docs/GIB_QR.md).
import { DEFAULT_CATALOG, type Catalog, type CatalogField } from './catalog';

const pick = (prefix: string) => DEFAULT_CATALOG.fields.filter(f => f.path.startsWith(`${prefix}.`));
const COMPANY = pick('Company');
const CUSTOMER = pick('Customer');
const field = (path: string, type: CatalogField['type'], label: string): CatalogField => ({ path, type, label });
const SAMPLE = DEFAULT_CATALOG.sample as { Company: Record<string, string>; Customer: Record<string, string> };
const qr = (content: Record<string, string>) => JSON.stringify(content);

/** e-Arşiv invoice to a consumer: the invoice catalog's fields with a retail sample. */
export const EARSIV_CATALOG: Catalog = {
  ...DEFAULT_CATALOG,
  name: 'e-Arşiv fatura',
  sample: {
    Company: SAMPLE.Company,
    Customer: { Name: 'Ayşe Yılmaz', Address: 'Bağdat Cad. No:210 D:4 Kadıköy / İstanbul', TaxOffice: '', TaxNumber: '12345678901' },
    Document: {
      Number: 'EAR2026000000456', Date: '2026-11-13T16:05:00', DueDate: '2026-11-13', Type: 'SATIŞ',
      Ettn: '7a6b5c4d-3e2f-4a1b-9c8d-0e1f2a3b4c5d', Currency: 'TRY', Note: 'İrsaliye yerine geçer.',
      QrContent: qr({
        vkntckn: '1234567890', avkntckn: '12345678901', senaryo: 'EARSIVFATURA', tip: 'SATIS', tarih: '2026-11-13',
        no: 'EAR2026000000456', ettn: '7a6b5c4d-3e2f-4a1b-9c8d-0e1f2a3b4c5d', parabirimi: 'TRY', malhizmettoplam: '849.90',
        'kdvmatrah(1)': '660.00', 'hesaplanankdv(1)': '6.60', 'kdvmatrah(20)': '189.90', 'hesaplanankdv(20)': '37.98',
        vergidahil: '894.48', odenecek: '894.48',
      }),
    },
    Totals: { Subtotal: 849.9, Discount: 0, Vat: 44.58, Grand: 894.48 },
    Lines: [
      { LineNumber: 1, Product: { Code: 'SU-05', Name: 'Su 0,5 L', Barcode: '8690000000110' }, Quantity: 24, Unit: 'Adet', Price: 10, VatRate: 1, Discount: 0, Total: 240 },
      { LineNumber: 2, Product: { Code: 'CAY-1KG', Name: 'Siyah Çay 1 kg', Barcode: '8690000000127' }, Quantity: 2, Unit: 'Paket', Price: 210, VatRate: 1, Discount: 0, Total: 420 },
      { LineNumber: 3, Product: { Code: 'DET-3KG', Name: 'Toz Çamaşır Deterjanı Renkliler İçin 3 kg', Barcode: '8690000000134' }, Quantity: 1, Unit: 'Adet', Price: 189.9, VatRate: 20, Discount: 0, Total: 189.9 },
    ],
    VatBreakdown: [
      { Rate: 1, Base: 660, Amount: 6.6 },
      { Rate: 20, Base: 189.9, Amount: 37.98 },
    ],
  },
};

/** e-İrsaliye (despatch advice): goods shipped, without prices. */
export const DESPATCH_CATALOG: Catalog = {
  catalogVersion: 1,
  name: 'Sevk irsaliyesi',
  fields: [
    ...COMPANY,
    ...CUSTOMER,
    field('Document.Number', 'string', 'İrsaliye no'),
    field('Document.Date', 'datetime', 'Düzenleme tarihi'),
    field('Document.Ettn', 'string', 'ETTN'),
    field('Document.Note', 'string', 'Not'),
    field('Document.QrContent', 'string', 'Karekod içeriği (GİB JSON)'),
    field('Shipment.Date', 'datetime', 'Fiili sevk tarihi'),
    field('Shipment.Plate', 'string', 'Araç plakası'),
    field('Shipment.Driver', 'string', 'Şoför'),
    field('Shipment.DeliveryAddress', 'string', 'Teslim adresi'),
    {
      path: 'Lines', type: 'array', label: 'Satırlar', items: [
        field('LineNumber', 'number', 'Sıra no'),
        field('Product.Code', 'string', 'Ürün kodu'),
        field('Product.Name', 'string', 'Ürün adı'),
        field('Quantity', 'number', 'Miktar'),
        field('Unit', 'string', 'Birim'),
      ],
    },
  ],
  sample: {
    Company: SAMPLE.Company,
    Customer: SAMPLE.Customer,
    Document: {
      Number: 'IRS2026000000045', Date: '2026-11-13T09:30:00', Ettn: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e', Note: 'Koliler açılmadan teslim alınmıştır.',
      QrContent: qr({
        vkntckn: '1234567890', avkntckn: '9876543210', senaryo: 'TEMELIRSALIYE', tip: 'SEVK', tarih: '2026-11-13',
        no: 'IRS2026000000045', ettn: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e', sevktarihi: '2026-11-13', sevkzamani: '09:32:13', plaka: '34ABC123',
      }),
    },
    Shipment: { Date: '2026-11-13T09:32:13', Plate: '34 ABC 123', Driver: 'Mehmet Kaya', DeliveryAddress: 'Deniz Market Depo, Sanayi Mah. 12. Sok. No:8 Çankaya / Ankara' },
    Lines: [
      { LineNumber: 1, Product: { Code: 'SUT-1L', Name: 'Süt 1L' }, Quantity: 20, Unit: 'Koli' },
      { LineNumber: 2, Product: { Code: 'PEY-500', Name: 'Beyaz Peynir 500 g' }, Quantity: 48, Unit: 'Paket' },
      { LineNumber: 3, Product: { Code: 'YOG-3KG', Name: 'Süzme Yoğurt Tam Yağlı 3 kg Kova' }, Quantity: 12, Unit: 'Adet' },
    ],
  },
};

/** Collection receipt: payments received from a customer. Not an e-document, so no karekod. */
export const RECEIPT_CATALOG: Catalog = {
  catalogVersion: 1,
  name: 'Tahsilat makbuzu',
  fields: [
    ...COMPANY,
    field('Customer.Name', 'string', 'Müşteri adı'),
    field('Customer.Code', 'string', 'Cari kod'),
    field('Customer.TaxNumber', 'string', 'Müşteri VKN'),
    field('Document.Number', 'string', 'Makbuz no'),
    field('Document.Date', 'datetime', 'Makbuz tarihi'),
    field('Document.Note', 'string', 'Açıklama'),
    field('Collector.Name', 'string', 'Tahsil eden'),
    field('Totals.Paid', 'number', 'Tahsil edilen'),
    field('Totals.PaidInWords', 'string', 'Tutar (yazıyla)'),
    field('Totals.PreviousBalance', 'number', 'Önceki bakiye'),
    field('Totals.Balance', 'number', 'Kalan bakiye'),
    {
      path: 'Payments', type: 'array', label: 'Ödemeler', items: [
        field('Method', 'string', 'Ödeme şekli'),
        field('Reference', 'string', 'Çek / kart no'),
        field('DueDate', 'date', 'Vade'),
        field('Amount', 'number', 'Tutar'),
      ],
    },
  ],
  sample: {
    Company: SAMPLE.Company,
    Customer: { Name: 'Deniz Market Ltd. Şti.', Code: 'C-1042', TaxNumber: '9876543210' },
    Document: { Number: 'THS2026000000078', Date: '2026-11-13T11:20:00', Note: 'Kasım ayı ödemesi.' },
    Collector: { Name: 'Selin Demir' },
    Totals: { Paid: 5250, PaidInWords: 'Beş bin iki yüz elli Türk lirası', PreviousBalance: 12480.4, Balance: 7230.4 },
    Payments: [
      { Method: 'Nakit', Reference: '', DueDate: '', Amount: 1500 },
      { Method: 'Çek', Reference: 'No 558812', DueDate: '2026-12-30', Amount: 3000 },
      { Method: 'Kredi kartı', Reference: '**** 4242', DueDate: '', Amount: 750 },
    ],
  },
};

/** Restaurant bill (e-Adisyon). */
export const ADISYON_CATALOG: Catalog = {
  catalogVersion: 1,
  name: 'Adisyon',
  fields: [
    ...COMPANY,
    field('Document.Number', 'string', 'Adisyon no'),
    field('Document.Date', 'datetime', 'Tarih'),
    field('Document.Ettn', 'string', 'ETTN'),
    field('Document.QrContent', 'string', 'Karekod içeriği (GİB JSON)'),
    field('Order.Table', 'string', 'Masa'),
    field('Order.Waiter', 'string', 'Garson'),
    field('Order.Guests', 'number', 'Kişi sayısı'),
    field('Totals.Subtotal', 'number', 'Ara toplam'),
    field('Totals.Discount', 'number', 'İndirim'),
    field('Totals.Grand', 'number', 'Toplam'),
    {
      path: 'Lines', type: 'array', label: 'Satırlar', items: [
        field('Product.Name', 'string', 'Ürün adı'),
        field('Quantity', 'number', 'Adet'),
        field('Price', 'number', 'Birim fiyat'),
        field('Total', 'number', 'Tutar'),
      ],
    },
  ],
  sample: {
    Company: { Name: 'Lezzet Lokantası', Address: 'Moda Cad. No:42 Kadıköy / İstanbul', Phone: '0216 111 22 33', TaxOffice: 'Kadıköy', TaxNumber: '2345678901' },
    Document: {
      Number: 'ADS2026000000310', Date: '2026-11-13T20:45:00', Ettn: '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9',
      QrContent: qr({
        vkntckn: '2345678901', avkntckn: '11111111111', senaryo: 'EARSIVBELGE', tip: 'ADISYON', tarih: '2026-11-13',
        no: 'ADS2026000000310', ettn: '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9', 'odenecek(TRY)': '1170.00',
      }),
    },
    Order: { Table: 'Bahçe 12', Waiter: 'Ali', Guests: 3 },
    Totals: { Subtotal: 1170, Discount: 0, Grand: 1170 },
    Lines: [
      { Product: { Name: 'Mercimek Çorbası' }, Quantity: 2, Price: 85, Total: 170 },
      { Product: { Name: 'Izgara Köfte (Pilav ve Közlenmiş Biber ile)' }, Quantity: 2, Price: 320, Total: 640 },
      { Product: { Name: 'Ayran' }, Quantity: 3, Price: 40, Total: 120 },
      { Product: { Name: 'Künefe' }, Quantity: 1, Price: 180, Total: 180 },
      { Product: { Name: 'Çay' }, Quantity: 3, Price: 20, Total: 60 },
    ],
  },
};
