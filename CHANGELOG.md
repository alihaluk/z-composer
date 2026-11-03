# Changelog

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
