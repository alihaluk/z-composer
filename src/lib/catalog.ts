// Field catalog (docs/SCOPE.md D2): the data structure a template can bind to.

export type FieldType = 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'image' | 'array';

export interface CatalogField {
  /** Dot path; for items of an array field it is relative to one item. */
  path: string;
  type: FieldType;
  label?: string;
  /** Item fields of an array field. */
  items?: CatalogField[];
}

export interface Catalog {
  catalogVersion: 1;
  name: string;
  fields: CatalogField[];
  /** One example document, used for previews. */
  sample?: unknown;
}

export const ROOT_PREFIX = '$.';

/** Scalar fields a band can bind to: item fields inside a repeating band, plus document fields. */
export function fieldsForBand(catalog: Catalog, repeat?: string): { path: string; field: CatalogField; group: string }[] {
  const scalars = (fields: CatalogField[], prefix = '') =>
    fields.filter(f => f.type !== 'array').map(f => ({ path: prefix + f.path, field: f, group: f.path.includes('.') ? f.path.split('.')[0] : '' }));
  const documentFields = scalars(catalog.fields, repeat ? ROOT_PREFIX : '');
  if (!repeat) return documentFields;
  const array = catalog.fields.find(f => f.path === repeat && f.type === 'array');
  return [...scalars(array?.items ?? []), ...documentFields];
}

export const arrayFields = (catalog: Catalog) => catalog.fields.filter(f => f.type === 'array');

/** Finds the catalog field a binding path refers to in the context of a band. */
export function findField(catalog: Catalog, path: string, repeat?: string): CatalogField | undefined {
  if (path.startsWith(ROOT_PREFIX) || !repeat) {
    const rootPath = path.replace(ROOT_PREFIX, '');
    return catalog.fields.find(f => f.path === rootPath);
  }
  return catalog.fields.find(f => f.path === repeat)?.items?.find(f => f.path === path);
}

export const fieldLabel = (field: CatalogField) => field.label || field.path;

export const DEFAULT_CATALOG: Catalog = {
  catalogVersion: 1,
  name: 'Genel fatura',
  fields: [
    { path: 'Company.Name', type: 'string', label: 'Firma adı' },
    { path: 'Company.Address', type: 'string', label: 'Firma adresi' },
    { path: 'Company.Phone', type: 'string', label: 'Firma telefonu' },
    { path: 'Company.TaxOffice', type: 'string', label: 'Firma vergi dairesi' },
    { path: 'Company.TaxNumber', type: 'string', label: 'Firma VKN' },
    { path: 'Company.Logo', type: 'image', label: 'Firma logosu' },
    { path: 'Customer.Name', type: 'string', label: 'Müşteri adı' },
    { path: 'Customer.Address', type: 'string', label: 'Müşteri adresi' },
    { path: 'Customer.TaxOffice', type: 'string', label: 'Müşteri vergi dairesi' },
    { path: 'Customer.TaxNumber', type: 'string', label: 'Müşteri VKN' },
    { path: 'Document.Number', type: 'string', label: 'Belge no' },
    { path: 'Document.Date', type: 'datetime', label: 'Belge tarihi' },
    { path: 'Document.DueDate', type: 'date', label: 'Vade tarihi' },
    { path: 'Document.Type', type: 'string', label: 'Belge tipi' },
    { path: 'Document.Ettn', type: 'string', label: 'ETTN' },
    { path: 'Document.Currency', type: 'string', label: 'Para birimi' },
    { path: 'Document.Note', type: 'string', label: 'Not' },
    { path: 'Document.QrContent', type: 'string', label: 'Karekod içeriği (GİB JSON)' },
    { path: 'Totals.Subtotal', type: 'number', label: 'Ara toplam' },
    { path: 'Totals.Discount', type: 'number', label: 'Toplam indirim' },
    { path: 'Totals.Vat', type: 'number', label: 'Toplam KDV' },
    { path: 'Totals.Grand', type: 'number', label: 'Genel toplam' },
    {
      path: 'Lines', type: 'array', label: 'Satırlar', items: [
        { path: 'LineNumber', type: 'number', label: 'Sıra no' },
        { path: 'Product.Code', type: 'string', label: 'Ürün kodu' },
        { path: 'Product.Name', type: 'string', label: 'Ürün adı' },
        { path: 'Product.Barcode', type: 'string', label: 'Ürün barkodu' },
        { path: 'Quantity', type: 'number', label: 'Miktar' },
        { path: 'Unit', type: 'string', label: 'Birim' },
        { path: 'Price', type: 'number', label: 'Birim fiyat' },
        { path: 'VatRate', type: 'number', label: 'KDV oranı' },
        { path: 'Discount', type: 'number', label: 'İndirim' },
        { path: 'Total', type: 'number', label: 'Satır toplamı' },
      ],
    },
    {
      path: 'VatBreakdown', type: 'array', label: 'KDV dökümü', items: [
        { path: 'Rate', type: 'number', label: 'Oran' },
        { path: 'Base', type: 'number', label: 'Matrah' },
        { path: 'Amount', type: 'number', label: 'KDV tutarı' },
      ],
    },
  ],
  sample: {
    Company: { Name: 'Örnek Gıda A.Ş.', Address: 'Atatürk Cad. No:1 Kadıköy / İstanbul', Phone: '0216 000 00 00', TaxOffice: 'Kadıköy', TaxNumber: '1234567890' },
    Customer: { Name: 'Deniz Market Ltd. Şti.', Address: 'İnönü Sok. No:5 Çankaya / Ankara', TaxOffice: 'Çankaya', TaxNumber: '9876543210' },
    Document: {
      Number: 'FTR2026000000123', Date: '2026-11-13T14:37:00', DueDate: '2026-12-13', Type: 'SATIŞ',
      Ettn: '1f2e3d4c-5b6a-4789-8abc-def012345678', Currency: 'TRY', Note: 'Teşekkür ederiz.',
      // Karekod content as the GİB guide defines it (docs/GIB_QR.md); amounts match the lines below.
      QrContent: '{"vkntckn":"1234567890","avkntckn":"9876543210","senaryo":"TEMELFATURA","tip":"SATIS","tarih":"2026-11-13",'
        + '"no":"FTR2026000000123","ettn":"1f2e3d4c-5b6a-4789-8abc-def012345678","parabirimi":"TRY","malhizmettoplam":"2751.50",'
        + '"kdvmatrah(1)":"2401.50","hesaplanankdv(1)":"24.02","kdvmatrah(20)":"350.00","hesaplanankdv(20)":"70.00",'
        + '"vergidahil":"2845.52","odenecek":"2845.52"}',
    },
    Totals: { Subtotal: 2751.5, Discount: 0, Vat: 94.02, Grand: 2845.52 },
    Lines: [
      { LineNumber: 1, Product: { Code: 'SUT-1L', Name: 'Süt 1L', Barcode: '8690000000011' }, Quantity: 10, Unit: 'Adet', Price: 120.05, VatRate: 1, Discount: 0, Total: 1200.5 },
      { LineNumber: 2, Product: { Code: 'PEY-500', Name: 'Beyaz Peynir 500 g', Barcode: '8690000000028' }, Quantity: 5, Unit: 'Paket', Price: 240.2, VatRate: 1, Discount: 0, Total: 1201 },
      { LineNumber: 3, Product: { Code: 'PEY-1KG', Name: 'Tam Yağlı Beyaz Peynir Ezine 1 kg Vakumlu', Barcode: '8690000000035' }, Quantity: 1, Unit: 'Adet', Price: 350, VatRate: 20, Discount: 0, Total: 350 },
    ],
    VatBreakdown: [
      { Rate: 1, Base: 2401.5, Amount: 24.02 },
      { Rate: 20, Base: 350, Amount: 70 },
    ],
  },
};
