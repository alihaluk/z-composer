# Changelog

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
