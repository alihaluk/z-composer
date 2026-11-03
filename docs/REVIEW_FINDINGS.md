# Review Findings

Findings from the review at the end of each roadmap step (docs/SCOPE.md). Critical findings are fixed in the step that found them; the rest are tracked here.

Severity: **critical** (wrong output, data loss, broken core flow) · **major** (feature works incorrectly in a common case) · **minor** (cosmetic, rare, or a known approximation).

| ID | Step | Severity | Status | Finding |
|---|---|---|---|---|
| R4-1 | 4 | critical | fixed | Clicking an empty spot of a band selected it and the click then bubbled to the canvas, which cleared the selection again. |
| R4-2 | 4 | critical | fixed | The new storage key hid templates that users had saved with the v1 designer. They are now migrated once from `zcomposer_templates`. |
| R4-3 | 4 | critical | fixed | Reading `localStorage` threw when storage is blocked (private mode, sandboxed iframes) and stopped the designer from starting. |
| R4-4 | 4 | major | fixed | Catalog paths were not validated. A path containing a space, `\|` or `}` would break placeholders and band markers. Catalog files, imports and templates now reject invalid paths and formats (step 6). |
| R4-5 | 4 | minor | open | Barcode and QR boxes on the canvas are not tied to the printed size: the QR size depends on its content and magnification, Code 128 on its data and bar width, and the Code 128 text line prints below the box. |
| R4-6 | 4 | minor | open | Rotated text is only approximated on the canvas; the preview shows it exactly. |
| R4-7 | 4 | minor | open | Images migrated from v1 are re-encoded in the background; if an image cannot be decoded, this is retried on every template change. |
| R4-8 | 4 | minor | fixed | The "Import" control was a label around a hidden file input and could not be reached with the keyboard. File pickers are now real buttons (step 6). |
| R4-9 | 4 | minor | open | New text elements get the English placeholder content "Text" in every language. |
| R5-1 | 5 | critical | fixed | `^BC` reads `>` plus the next character as a control code, even when escaped with `^FH`: "AB>CD" was encoded as "ABD". Static and filled Code 128 data now write `>` as `>0` (spec 5.2, step 7); the preview decodes it like a printer. |
| R5-2 | 5 | major | fixed | `^FB` reads `\&` as a line break and drops a single `\`, also after `^FH` decoding. Aligned and wrapped fields now write `\` as `\\` (spec 5.2, step 7). |
| R5-3 | 5 | minor | open | The printer font draws `\` like `¢` (seen in Labelary with `^CI28`). This is a property of the resident font, not of the output. |
| R5-4 | 5 | minor | open | A filled template longer than the printer's maximum label length (`^LL` up to 32000 dots) is not split; the spec leaves this to the filler. |
| R6-1 | 6 | major | fixed | JSON Schemas from .NET and Java generators write nullable references as `oneOf` / `anyOf` with a `null` alternative; such objects were read as text fields and their sub-fields were lost. |
| R6-2 | 6 | minor | open | The reasons for skipped keys ("array of values", "nested array", "name") are shown in English in every language. |
| R6-3 | 6 | minor | open | The catalog editor can change types and labels and remove fields, but not add a field by hand; new fields come from a sample or schema. |
| R6-4 | 6 | minor | open | The saved `fieldsUsed` snapshot is written but only missing fields are reported; a field whose type changed in the catalog is not flagged. |
| R6-5 | 6 | minor | open | Arrays inside array items (e.g. line discounts) cannot be bound; they are skipped with a note. Nested repeating bands would be needed. |
| R7-1 | 7 | minor | open | On the canvas a growing text wraps but its band does not grow; only the preview shows the grown band. |
| R7-2 | 7 | minor | open | The preview culture is not remembered across reloads and does not follow the interface language. |
| R7-3 | 7 | minor | open | The preview culture list is fixed (tr-TR, en-US, en-GB, de-DE, fr-FR); other cultures cannot be entered. |
