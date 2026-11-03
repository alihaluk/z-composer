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
| R5-1 | 5 | critical | fixed | `^BC` reads `>` plus the next character as a control code, even when escaped with `^FH`: "AB>CD" was encoded as "ABD". Static and filled Code 128 data now write `>` as `>0` (spec 5.2, step 7); the preview decodes it like a printer. |
| R5-2 | 5 | major | fixed | `^FB` reads `\&` as a line break and drops a single `\`, also after `^FH` decoding. Aligned and wrapped fields now write `\` as `\\` (spec 5.2, step 7). |
| R5-3 | 5 | minor | open | The printer font draws `\` like `¢` (seen in Labelary with `^CI28`). This is a property of the resident font, not of the output. |
| R5-4 | 5 | minor | open | A filled template longer than the printer's maximum label length (`^LL` up to 32000 dots) is not split; the spec leaves this to the filler. |
