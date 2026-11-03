# Review Findings

Findings from the review at the end of each roadmap step (docs/SCOPE.md). Critical findings are fixed in the step that found them; the rest are tracked here.

Severity: **critical** (wrong output, data loss, broken core flow) · **major** (feature works incorrectly in a common case) · **minor** (cosmetic, rare, or a known approximation).

| ID | Step | Severity | Status | Finding |
|---|---|---|---|---|
| R4-1 | 4 | critical | fixed | Clicking an empty spot of a band selected it and the click then bubbled to the canvas, which cleared the selection again. |
| R4-2 | 4 | critical | fixed | The new storage key hid templates that users had saved with the v1 designer. They are now migrated once from `zcomposer_templates`. |
| R4-3 | 4 | critical | fixed | Reading `localStorage` threw when storage is blocked (private mode, sandboxed iframes) and stopped the designer from starting. |
| R4-4 | 4 | major | open | Catalog paths are not validated. A path containing a space, `\|` or `}` would break placeholders and band markers. To be fixed with the catalog import in step 6. |
| R4-5 | 4 | minor | open | Barcode and QR boxes on the canvas are not tied to the printed size: the QR size depends on its content and magnification, Code 128 on its data and bar width, and the Code 128 text line prints below the box. |
| R4-6 | 4 | minor | open | Rotated text is only approximated on the canvas; the preview shows it exactly. |
| R4-7 | 4 | minor | open | Images migrated from v1 are re-encoded in the background; if an image cannot be decoded, this is retried on every template change. |
| R4-8 | 4 | minor | open | The "Import" control is a label around a hidden file input and cannot be reached with the keyboard. |
| R4-9 | 4 | minor | open | New text elements get the English placeholder content "Text" in every language. |
