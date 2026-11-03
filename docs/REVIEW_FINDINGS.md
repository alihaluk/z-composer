# Review Findings

Findings from the review at the end of each roadmap step (docs/SCOPE.md). Critical findings are fixed in the step that found them; the rest are tracked here.

Status at version 1.0.0: no finding is open. *deferred* items are planned in docs/SCOPE.md (Later); *accepted* and *won't fix* items are known limitations.

Severity: **critical** (wrong output, data loss, broken core flow) · **major** (feature works incorrectly in a common case) · **minor** (cosmetic, rare, or a known approximation).

| ID | Step | Severity | Status | Finding |
|---|---|---|---|---|
| R4-1 | 4 | critical | fixed | Clicking an empty spot of a band selected it and the click then bubbled to the canvas, which cleared the selection again. |
| R4-2 | 4 | critical | fixed | The new storage key hid templates that users had saved with the v1 designer. They are now migrated once from `zcomposer_templates`. |
| R4-3 | 4 | critical | fixed | Reading `localStorage` threw when storage is blocked (private mode, sandboxed iframes) and stopped the designer from starting. |
| R4-4 | 4 | major | fixed | Catalog paths were not validated. A path containing a space, `\|` or `}` would break placeholders and band markers. Catalog files, imports and templates now reject invalid paths and formats (step 6). |
| R4-5 | 4 | minor | fixed | Barcode and QR boxes on the canvas are not tied to the printed size: the QR size depends on its content and magnification, Code 128 on its data and bar width, and the Code 128 text line prints below the box. (final pass: the barcode panel shows the printed size for the sample data and can fit the box to it) |
| R4-6 | 4 | minor | fixed | Rotated text is only approximated on the canvas; the preview shows it exactly. (final pass: rotated text is laid out in its rotated box like ^FO) |
| R4-7 | 4 | minor | fixed | Images migrated from v1 are re-encoded in the background; an image that could not be decoded was retried on every template change. Each image is now tried once (step 10). |
| R4-8 | 4 | minor | fixed | The "Import" control was a label around a hidden file input and could not be reached with the keyboard. File pickers are now real buttons (step 6). |
| R4-9 | 4 | minor | fixed | New text elements got the English placeholder content "Text" in every language; it now follows the interface language (step 9). |
| R5-1 | 5 | critical | fixed | `^BC` reads `>` plus the next character as a control code, even when escaped with `^FH`: "AB>CD" was encoded as "ABD". Static and filled Code 128 data now write `>` as `>0` (spec 5.2, step 7); the preview decodes it like a printer. |
| R5-2 | 5 | major | fixed | `^FB` reads `\&` as a line break and drops a single `\`, also after `^FH` decoding. Aligned and wrapped fields now write `\` as `\\` (spec 5.2, step 7). |
| R5-3 | 5 | minor | won't fix: property of the printer font | The printer font draws `\` like `¢` (seen in Labelary with `^CI28`). This is a property of the resident font, not of the output. |
| R5-4 | 5 | minor | by design: left to the filler (spec section 11) | A filled template longer than the printer's maximum label length (`^LL` up to 32000 dots) is not split; the spec leaves this to the filler. |
| R6-1 | 6 | major | fixed | JSON Schemas from .NET and Java generators write nullable references as `oneOf` / `anyOf` with a `null` alternative; such objects were read as text fields and their sub-fields were lost. |
| R6-2 | 6 | minor | fixed | The reasons for skipped keys ("array of values", "nested array", "name") are shown in English in every language. (final pass: reasons are translated) |
| R6-3 | 6 | minor | fixed | The catalog editor can change types and labels and remove fields, but not add a field by hand; new fields come from a sample or schema. (final pass: fields can be added by hand) |
| R6-4 | 6 | minor | fixed | The saved `fieldsUsed` snapshot is written but only missing fields are reported; a field whose type changed in the catalog is not flagged. (final pass: type changes since saving are reported) |
| R6-5 | 6 | minor | deferred | Arrays inside array items (e.g. line discounts) cannot be bound; they are skipped with a note. Nested repeating bands would be needed. (SCOPE roadmap, Later) |
| R7-1 | 7 | minor | fixed | On the canvas a growing text wrapped but its band did not grow. In sample mode the canvas now breaks the text like the filler and grows the band (step 8). |
| R7-2 | 7 | minor | fixed | The preview culture now starts from the interface language (step 10) but is not remembered across reloads. (final pass: the culture is remembered unless the host fixes it) |
| R7-3 | 7 | minor | fixed | The preview culture list is fixed (tr-TR, en-US, en-GB, de-DE, fr-FR); other cultures cannot be entered. (final pass: any culture the browser supports can be entered) |
| R8-1 | 8 | minor | fixed | In sample mode, dropping an element below a grown text measures its position from the grown layout, so it lands lower by the growth than it appears. (final pass: drops below a grown text are converted back to stored positions) |
| R8-2 | 8 | minor | by design: the preview shows all items | Sample mode shows only the first item of a repeating band; wrapping of later items is visible only in the preview. |
| R8-3 | 8 | minor | fixed | Non-growing wrapped text is wrapped by the browser on the canvas, by the printer's `^FB` in print; break points can differ slightly. (the preview shows the printer's breaks) (1.3.0: the canvas breaks wrapped text where the printer's `^FB` does, with the printer font widths) |
| R9-1 | 9 | minor | fixed | There is no rubber-band selection; several elements are selected with Shift or Ctrl click. (final pass: dragging on an empty spot of a band selects by rectangle) |
| R9-2 | 9 | minor | fixed | A selection is limited to one band; elements of different bands cannot be moved or aligned together. (SCOPE roadmap, Later) (1.3.0: Shift / Ctrl click and rectangle selection add elements of other bands; they move, align, duplicate and delete together) |
| R9-3 | 9 | minor | fixed | The shortcut list names Ctrl only; on macOS the same shortcuts also work with Cmd. (final pass: shortcuts show Ctrl/⌘) |
| R10-1 | 10 | major | fixed | Without Tailwind's global reset the library's ring utilities had no default variables and `.container` was not scoped; both are now defined or disabled under `.zc-root`. |
| R10-2 | 10 | minor | decided | The package is `private`; publishing it to a registry is a separate decision. (owner: stays private for now) |
| R10-3 | 10 | minor | fixed | The library stylesheet embeds the preview font (about 80 kB) and the barcode chunk is about 290 kB gzipped; both load only with the designer or the first barcode preview. (1.3.0: only the Code 128 and QR encoders are bundled; the barcode chunk is about 34 kB gzipped instead of 290 kB. The font stays: the canvas needs it from the first render) |
| R10-4 | 10 | minor | fixed | When the host fixes `language`, the language switcher is still shown and lets the user switch for the session. (final pass: the switcher is hidden when the host fixes the language) |
| R11-1 | final | minor | documented | The Labelary emulator draws nothing for `₺` with `^A0`; the resident font may not contain the Turkish lira sign. Templates should print the currency code (e.g. `TRY`, `TL`) instead. |
| R11-2 | final | minor | fixed | Preview text widths came from the substitute font. They now come from the printer font's measured advance widths; text edges are within about 1 dot of the emulator on the invoice preset. |
| U-1 | UI review | critical | fixed | The selection outline was invisible: tailwind-merge dropped the `outline` style class, so neither the selected element nor the hover state was outlined. |
| U-2 | UI review | major | fixed | Button tokens (`accent`, `ring`, `input`, `background`) were not defined, so outline and ghost buttons had no hover state and keyboard focus was not visible. |
| U-3 | UI review | major | fixed | Elements could only be added by dragging. Tools now also add their element to the selected band on click, Enter or Space. |
| U-4 | UI review | major | fixed | The canvas was centred with flexbox, so on narrow screens the left part (band labels) could not be scrolled to and the page was cut off. It now centres safely, zooms to fit on first show, and has zoom buttons with "fit page". |
| U-5 | UI review | major | fixed | An empty design gave no guidance. It now shows how to start and offers the invoice preset. |
| U-6 | UI review | minor | fixed | Default band names were English in the Turkish interface; new templates and the preset use the interface language. |
| U-7 | UI review | minor | fixed | The canvas opened in field-name mode, where long placeholders overlap their neighbours. It now opens with sample data when the catalog has one; fields without a sample value show their name faded. |
| U-8 | UI review | minor | fixed | Hints and section titles used gray-400 (about 2.5:1 contrast); they use gray-500 (about 4.8:1). |
| U-9 | UI review | minor | fixed | The title wrapped onto two lines, "dots" was not translated, and the default catalog name was English. |
| U-10 | UI review | minor | fixed | Dialogs did not move focus; they now focus their close / cancel button. |
| U-11 | UI review | minor | fixed | Dialogs do not trap Tab focus inside them. (1.2.0: Tab stays inside, focus returns to the opener on close) |
| U-12 | UI review | minor | fixed | Below about 1000 px width the fixed side panels leave little room for the canvas; the designer is a desktop tool. (1.2.0: both side panels can be hidden) |
| U-13 | UI review | minor | fixed | Band labels mark conditions with the text "if" rather than an icon. (1.2.0: a filter icon; the tooltip names the field and the operator) |
| U-14 | UI review | major | fixed | While a dialog was open, canvas shortcuts still worked: Delete, the arrow keys or Ctrl+Z changed the design behind the preview. |
| C-1 | conformance | major | fixed | The reference filler did not reject templates with a newer `spec` version, although section 13 requires it. |
| C-2 | conformance | minor | fixed | `notZero` treated `"1e3"`, `"0x0"` or `"Infinity"` as numbers while the number formats did not; both now use the numeric string definition of section 6.1. |
| C-3 | conformance | minor | documented | The specification did not say what `^LL` is when nothing is printed (the filler wrote 1), nor that unknown markers are ignored; both are now stated. |
| C-4 | conformance | minor | fixed | A negative value that rounds to zero printed as `-0,00`; it now prints `0,00` (specification 6.1, two new cases). |
| D-1 | dependencies | minor | fixed | `npm audit` reports a moderate advisory for `minimatch` inside ESLint (development only; the fix needs ESLint 10). The shipped dependencies have no known vulnerabilities. (1.3.0: ESLint 10 and a `minimatch` override; `npm audit` reports no vulnerabilities) |

