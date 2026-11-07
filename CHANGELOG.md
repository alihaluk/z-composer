# Changelog

## 1.6.0 — 2026-11-07

### Added
- Field list in the sidebar: the catalog's fields, grouped and searchable (case, Turkish letters and accents do not matter; "musteri" finds "Müşteri"). Clicking a field adds an element bound to it to the selected band, below the band's last element; dragging drops it where it is released. Enter or Space adds the focused field.
- Fields come with sensible settings: numbers right-aligned with `N2` (`N0` when the sample value is whole), dates `dd.MM.yyyy`, date-times `dd.MM.yyyy HH:mm`, image fields as dynamic images, the GİB karekod field as a karekod QR in the top-right corner.
- Item fields of an array go to the band that repeats it, and only that band lights up while one is dragged; document fields in a repeating band are bound from the root (`$.`). Without such a band the list says how to make one.

### Changed
- The drag preview of a tool shows its translated name.

## 1.5.1 — 2026-11-07

### Added
- End-to-end tests (Playwright) run the built app in Chromium: elements, selection, bands, field binding and formats, composed content, barcodes and the GİB karekod, images, the preview dialog, the field catalog, saving, import and export, and the draft. CI runs them on every push (`npm run test:e2e`).

### Fixed
- Dragging a tool from the toolbox onto a band did nothing; only clicking a tool added an element. The drag context now covers the toolbox as well as the canvas.
- A new condition on a number field started as "not empty" instead of "not zero".
- "Custom pattern" in the format list chose `dd.MM.yyyy`, a listed format, so the pattern box never appeared; it now starts from `dd.MM.yyyy HH:mm` and shows the box.

## 1.5.0 — 2026-11-04

### Added
- GİB karekod setup for QR elements: binds the QR to the field that holds the karekod JSON and places it in the top-right corner, following the GİB *Karekod Standardı Kılavuzu* 1.1 ([docs/GIB_QR.md](./docs/GIB_QR.md)).

### Changed
- The invoice preset prints the karekod in the top-right corner at 2 dots per module (about 22 mm) instead of 44 mm in the footer.
- The default catalog's sample data is consistent (line totals, VAT breakdown and totals agree), uses a 16-character document number and a complete GİB karekod JSON.

## 1.4.0 — 2026-11-04

### Added
- Content builder: the content of a text, Code 128 or QR element can join static text and catalog fields in order, each field with its own format, culture and maximum length. The output uses the existing placeholders (specification 5.1), so fillers need no change.
- The standalone designer keeps the design being edited as a draft and reopens it after a reload.

### Fixed
- Upper-case titles follow the interface language (`İÇERİK`, not `İÇERIK`); the component root carries `lang`.

## 1.3.0 — 2026-11-03

### Added
- Selections across bands: Shift / Ctrl click or a rectangle adds elements of other bands; they move, align left / centre / right, duplicate and delete together.

### Changed
- The canvas breaks wrapped text where the printer's `^FB` breaks it, with the printer font widths, as the preview does.
- The barcode chunk bundles only the Code 128 and QR encoders: about 34 kB instead of 290 kB gzipped, with the same output.
- ESLint 10; `npm audit` reports no vulnerabilities.

## 1.2.0 — 2026-11-03

### Fixed
- Canvas shortcuts no longer act on the design while a dialog is open.
- A negative value that rounds to zero prints without a minus sign (`0,00`, not `-0,00`); the specification and the conformance suite say so.

### Changed
- Dialogs keep Tab focus inside and give focus back to the button that opened them.
- Both side panels can be hidden to give the canvas room on narrow screens.
- Band labels mark conditions with an icon; the tooltip names the repeat list or the condition.
- Dependencies updated within their ranges; `npm audit` fixes applied.

## 1.1.0 — 2026-11-03

### Added
- [Conformance suite](./conformance/README.md) for fillers: 21 language-independent cases (template, data, expected output) covering every section of the output specification. The reference filler runs it in CI.

### Changed
- The output specification defines numeric strings, a minimum length of 1 dot and that unknown markers are ignored.
- `fillTemplate` rejects templates with a newer specification version, and `notZero` accepts the same numeric strings as the number formats (`"1e3"` is no longer a number).

## 1.0.2 — 2026-11-03

### Fixed
- Selected and hovered elements are outlined again; buttons show hover and keyboard focus.
- The canvas stays reachable on narrow screens, zooms to fit on first show and has zoom buttons.

### Changed
- Tools can be added by click, Enter or Space, not only by dragging.
- Empty designs show how to start; band names follow the interface language; the canvas opens with sample data.
- Higher text contrast, translated leftovers, dialogs focus their close button.

## 1.0.1 — 2026-11-03

### Changed
- The preview places text with the printer font's advance widths, measured in the Labelary emulator; text edges are within about 1 dot of the emulator on the invoice preset.
- Characters-per-line estimates for growing text use the same widths.
- Package metadata and a `prepack` build; the package is ready for `npm publish` once `private` is removed.

## 1.0.0 — 2026-11-03

First complete version of the designer described in [docs/SCOPE.md](./docs/SCOPE.md).

### Added
- Templates as a list of bands; bands repeat over catalog arrays and can be hidden by conditions.
- Millimetre units, printer profile (printable width, 203 / 300 / 600 dpi), continuous receipt paper.
- ZPL template output defined by [docs/OUTPUT_SPEC.md](./docs/OUTPUT_SPEC.md): placeholders with culture-independent format codes, escaping, growing text, dynamic images.
- Field catalog from an example JSON or a JSON Schema, with editor, file format and missing / changed field warnings.
- In-browser preview renderer replacing Labelary, with real Code 128 and QR encoding.
- Sample-data canvas mode in any culture, overflow modes (truncate, wrap, grow).
- Multi-select, rectangle selection, group move and alignment, copy / paste / duplicate, layers, locking, shortcuts.
- Embeddable `<ZComposer>` component and library build (`npm run build:lib`).
- Tests (Vitest) and CI (lint, tests, app and library builds).

### Changed
- v1 templates and browser storage are migrated automatically.
- MIT license.

### Removed
- Line-print mode.
- The dependency on the Labelary web service.
