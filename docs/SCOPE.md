# Z-Composer — Scope & Design Decisions

Status: Accepted (2026-11-03) · Roadmap complete in version 1.0.0

## 1. Product Scope

Z-Composer is a template **designer**. Our deliverable is the design output; what consumers do with that output is outside our scope.

Users: tenant companies and our support team.

### In scope
- Visual editor — what the canvas shows is what the output produces (WYSIWYG).
- Template file (JSON) — versioned and documented.
- Design output — ZPL template, with a written output specification.
- Field catalog — import, edit and use.
- Preview with sample data, per culture, rendered entirely in the browser (see D7).
- Running standalone and embedded in a host application.

### Out of scope
- Filling placeholders with real data, sending output to printers, printer management.
- Server-side storage of templates and catalogs, users and permissions. These belong to the host application; we expose load/save hooks.
- Computing business values (totals, VAT, the values inside the GİB QR code). The designer defines where and how values appear; the content builder (see Roadmap) composes content from fields but never computes values.
- Translating static texts inside a template (see D4).
- Line-print (text-only) output.
- Fixed-length labels and pagination; only continuous roll paper is supported (see D6).

## 2. Decisions

### D1 — Outputs: JSON template + ZPL template
- The JSON template is the editable source of truth. It carries a `schemaVersion` and is validated on load.
- The ZPL template is the deliverable for printing systems. Its format is defined in [`docs/OUTPUT_SPEC.md`](./OUTPUT_SPEC.md).

### D2 — Field catalog is a separate file
Every company's data structure is different, so fields are not hardcoded.

- The catalog is a separate file, typically one per company DTO, and can be shared by many templates.
- Sources that are converted into the catalog format:
  1. **Sample JSON** (primary) — one serialized example document. Provides field paths, inferred types and preview data.
  2. **JSON Schema** (optional) — can be generated from .NET / Java DTOs.
  3. **Host application** — passes the catalog directly when the designer is embedded.
- An array of objects (e.g. `Lines`) can be chosen as the source of a repeating band (see D8). Fields in that band are relative to one array item, which removes ambiguity such as document `Total` vs. line `Lines[].Total`.
- Inferred types and display labels are editable in the catalog editor.
- The current company-specific field list is replaced by a generic default invoice catalog.
- A template keeps a snapshot (path + type) of the fields it uses, so it can report missing or changed fields when opened with a newer catalog.

Catalog file format (`catalogVersion` 1). Field types: `string`, `number`, `date`, `datetime`, `boolean`, `image`, `array`; paths follow the segment rules of docs/OUTPUT_SPEC.md section 5, and arrays cannot be nested:

```json
{
  "catalogVersion": 1,
  "name": "Acme invoice",
  "fields": [
    { "path": "DocNumber", "type": "string", "label": "Belge No" },
    { "path": "DocDate", "type": "datetime", "label": "Tarih" },
    { "path": "Total", "type": "number", "label": "Genel Toplam" },
    { "path": "Lines", "type": "array", "label": "Satırlar", "items": [
      { "path": "Product.Name", "type": "string", "label": "Ürün" },
      { "path": "Price", "type": "number", "label": "Fiyat" },
      { "path": "Total", "type": "number", "label": "Satır Toplamı" }
    ]}
  ],
  "sample": {
    "DocNumber": "FTR2026000123",
    "DocDate": "2026-11-13T14:37:00",
    "Total": 2401.0,
    "Lines": [{ "Product": { "Name": "Laptop" }, "Price": 1200.5, "Total": 2401.0 }]
  }
}
```

### D3 — Culture independence
A template stores the *meaning* of a format, never a culture-specific rendering.

- Format codes follow .NET standard format strings (`N2`, `d`, `t`, …), which are culture-sensitive by design. The supported set and its Java / JavaScript equivalents are defined in the output spec.
- Formatting is applied by whoever fills the template, using their culture.
- A fixed custom pattern (e.g. `dd.MM.yyyy`) may be chosen explicitly; it renders the same in every culture.
- The designer has a preview-culture selector (tr-TR, en-US, …).

| Chosen in designer | tr-TR | en-US |
|---|---|---|
| Number, 2 decimals (`N2`) | 1.234,56 | 1,234.56 |
| Short date (`d`) | 13.11.2026 | 11/13/2026 |
| Short time (`t`) | 14:37 | 2:37 PM |

### D4 — One template per language
Static texts (e.g. "Ara Toplam", "SAYIN") are not translated inside a template. A separate template is created for each language.

### D5 — Overflow behavior is the designer's choice
Nothing is forced. Each text element has an overflow mode:

- `none` (default) — printed as is.
- `truncate` — at most N characters.
- `wrap` — within the element width, at most N lines, aligned left / center / right.

With `wrap`, the designer also chooses whether the band keeps its designed height or grows with the number of lines the text needs (one growing element per band).

The canvas has a toggle between **field names** (e.g. `[Customer.Name]`) and **sample data**. In sample-data mode, format, preview culture, wrapping and truncation are applied live.

Note: ZPL `^FB` prints excess text over the last line instead of cutting it, so truncation is carried in the placeholder and applied by whoever fills the template.

### D6 — Printer profile per template
Asked when a template is created and stored in its settings:

- Paper width: 58 / 80 / 104 mm or custom.
- Resolution: 203 / 300 / 600 dpi.
- Media: continuous roll only. Fixed-length labels and pagination are out of scope.

The template stores the printable width (`^PW`), which is narrower than the paper itself. Users read the printable width from their printer's settings and enter it; the presets are only starting values.

Designs are measured in millimetres; ZPL coordinates are generated for the chosen resolution.

### D7 — Own preview renderer, no external services
The preview is rendered in the browser by our own ZPL renderer. Labelary or any other external service is not used.

- Sample data may contain real company and customer data; it must never leave the browser. The preview must also work offline, without rate limits or third-party terms.
- The renderer interprets the ZPL our output actually produces, so the preview shows the deliverable itself rather than a separate drawing of the model.
- It supports the ZPL subset defined in the output spec (e.g. `^FO`, `^A0`, `^FB`, `^FD`, `^FH`, `^GB`, `^GFA`, `^BC`, `^BQ`, `^BY`, `^PW`, `^LL`, `^CI28`) and renders at printer resolution (1 px = 1 dot).
- Barcodes and QR codes are really encoded (e.g. with bwip-js), so a previewed code can be scanned.
- Known limit: the printer font behind `^A0` (CG Triumvirate) is licensed. The preview draws an open substitute and places every character with the printer font's advance widths, measured in the Labelary emulator (`src/preview/fontMetrics.ts`). On the invoice preset, text edges are on average within 1 dot of the emulator; glyph shapes differ.
- For preview only, the designer fills placeholders with catalog sample data in the preview culture. This filler is internal and doubles as a reference implementation of the output spec.

### D8 — A template is a list of bands
The fixed header / body / footer sections are replaced by an ordered list of bands, so one template can hold several repeating blocks (invoice lines, VAT breakdown, installments, …).

- A band is either **static** (printed once) or **repeating** (printed once per item of an array field from the catalog, e.g. `Lines`, `VatBreakdown`).
- Inside a repeating band, field paths are relative to the current item.
- Each band has a designed height. Bands are printed top to bottom in order; each band starts where the previous one ends, and a repeating band stacks its copies.

### D9 — Conditional visibility
Elements and bands can be hidden based on a field value. Nothing is hidden unless the designer adds a condition.

- Conditions in the first version: hide if empty, hide if zero.
- A hidden band takes no space. A hidden element leaves its space empty; other elements do not move.
- Conditions are carried in the ZPL output and evaluated by whoever fills the template. The designer evaluates them for the preview.

## 3. Reference Printer

Real-device checks are done on a Zebra ZQ521 (203 dpi, ZPL) with 3-inch roll paper.

- The preview font width table (D7) is measured in the Labelary emulator; a check on real paper is not required (owner decision, 2026-11-03).
- Turkish characters are confirmed to print.
- 300 / 600 dpi output can only be checked in the preview until such a printer is available.

## 4. Open Items

Placeholder syntax and escaping, band and condition markers, length calculation, dynamic images, encoding and format codes are defined in [`docs/OUTPUT_SPEC.md`](./OUTPUT_SPEC.md).

- None at the moment; see docs/REVIEW_FINDINGS.md for known limitations.

## 5. Roadmap
1. ~~Output specification~~ — done: [`docs/OUTPUT_SPEC.md`](./OUTPUT_SPEC.md).
2. ~~Test baseline for the output and CI~~ — done: Vitest tests and `.github/workflows/ci.yml`.
3. ~~Own preview renderer replacing Labelary (D7)~~ — done: `src/preview`, with a width table for the printer font.
4. ~~Template schema v2~~ — done: millimetre units, printer profile, bands, conditions, overflow and format, v1 migration; the ZPL output follows docs/OUTPUT_SPEC.md and line-print mode is removed.
5. ~~Output correctness~~ — done: `^FH` escaping, bold text, images encoded at their current size, positions kept when moving between bands, plus `>` in Code 128 and `\` in field blocks (docs/REVIEW_FINDINGS.md).
6. ~~Field catalog~~ — done: file format, import from a sample JSON or a JSON Schema, editor, generic default invoice catalog, missing-field warnings and the `fieldsUsed` snapshot.
7. ~~Formats and preview~~ — done: format codes with live examples in the preview culture, culture selector on the canvas and in the preview, sample-data canvas mode.
8. ~~Overflow modes~~ — done: as is, truncate, wrap and alignment; growing text is wrapped and grows its band on the canvas exactly like the filler.
9. ~~Editor ergonomics~~ — done: multi-select with group move and alignment, copy / paste / duplicate, Delete key, layer list, locking, bring to front / send to back, shortcut list.
10. ~~Embedding API~~ — done: `<ZComposer>` with template, catalog, language, culture and save / change hooks, per-instance state and translations, scoped styles, `npm run build:lib` (INTEGRATION_GUIDE.md).

### Later (candidates)
- Publishing the package to npm; it stays `private` for now (owner decision, 2026-11-03).
- Nested repeating bands, for arrays inside array items (e.g. discounts per line). Owner decision (2026-11-04): not now, as it needs specification version 2.
- Fixed-length label support (gap / black-mark media) as a separate mode next to receipts.
- Further content presets on top of the content builder (1.4.0). The GİB karekod is handled in 1.5.0 by binding the QR to a JSON field the firm's system produces (owner decision, 2026-11-04; [docs/GIB_QR.md](./GIB_QR.md)).
