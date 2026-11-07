# Z-Composer

A visual designer for ZPL receipt and invoice templates for Zebra thermal printers. Z-Composer produces the design; whoever prints fills the template with data ([scope](./docs/SCOPE.md)).

**Live demo:** [alihaluk.github.io/z-composer](https://alihaluk.github.io/z-composer/)

## Features

- **Bands**: a template is a list of bands; a band is printed once or repeats for every item of an array (invoice lines, VAT breakdown, installments). Bands and elements can be hidden by conditions (not empty, not zero).
- **Elements**: text, box, line, Code 128, QR and images, positioned in millimetres with snapping to other elements, the page centre and a 0.5 mm grid.
- **Field catalog**: bind elements to the fields of your own data structure. The searchable field list adds a field with one click or drag: numbers come right-aligned and formatted, dates with a pattern, line fields go to the band that repeats them. Build the catalog from an example JSON document or a JSON Schema (.NET / Java DTOs), then adjust types and labels. A generic invoice catalog is included.
- **Content builder**: join static text and several fields in one text, Code 128 or QR element, each field with its own format (e.g. QR content in the invariant culture).
- **Culture-independent formats**: numbers and dates keep a format code (`N2`, `d`, `dd.MM.yyyy` ...), not a culture; the printing side applies its culture. The designer previews any culture.
- **Overflow**: text can stay as is, be truncated, or wrap; wrapped text can grow its band, and the canvas shows the grown rows.
- **Printer profile**: printable width and 203 / 300 / 600 dpi per template; continuous receipt paper.
- **Design check**: finds what would only show on paper (text or barcodes cut at the paper edge, lines that do not fit, fields missing from the catalog) by checking every sample row, and points to the element.
- **Own preview**: the ZPL output is drawn in the browser at printer resolution, with real Code 128 and QR encoding. No data leaves the browser.
- **Editing**: multi-select across bands, group move and alignment, copy / paste / duplicate, layers, locking, undo / redo, keyboard shortcuts.
- **Embeddable**: a React component with its own state, translations and scoped styles ([integration guide](./INTEGRATION_GUIDE.md)).
- **Turkish and English** interface.

## Output

The designer saves a JSON template and produces a ZPL template with placeholders such as `{{Totals.Grand|fmt=N2}}`. The format, the escaping rules and the filling algorithm are defined in the [output specification](./docs/OUTPUT_SPEC.md). Fillers in other languages can check themselves against the [conformance suite](./conformance/README.md).

## Development

```bash
npm install
npm run dev        # standalone app
npm test           # unit tests
npm run test:e2e   # end-to-end tests (first: npx playwright install chromium)
npm run lint
npm run build      # standalone app → dist/
npm run build:lib  # embeddable package → dist-lib/
```

Pushes to `main` run CI (lint, tests, both builds) and deploy the standalone app to GitHub Pages.

## Documentation

- [Scope and design decisions](./docs/SCOPE.md), including the roadmap
- [ZPL template output specification](./docs/OUTPUT_SPEC.md)
- [Conformance suite for fillers](./conformance/README.md)
- [GİB karekod (e-Fatura / e-Arşiv)](./docs/GIB_QR.md)
- [Integration guide](./INTEGRATION_GUIDE.md)
- [Review findings](./docs/REVIEW_FINDINGS.md)
- [Changelog](./CHANGELOG.md)

## License

[MIT](./LICENSE)
