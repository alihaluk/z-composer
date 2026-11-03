# Z-Composer — ZPL Template Output Specification

Status: Version 1 (2026-11-03), implemented by Z-Composer 1.0.0

## 1. Purpose

This document defines the ZPL template that Z-Composer produces. It is written for anyone who fills a template with data and sends it to a printer — the **filler**. The JSON template and the field catalog are documented separately.

A filler only needs to understand four things:

1. the prologue (`^LL` line),
2. the marker lines (`^FX ZC:…`),
3. the band offset lines (`^LH`),
4. the placeholders (`{{…}}`).

Everything else in an element line is opaque ZPL and must be passed through unchanged.

## 2. Overview

- A template is syntactically valid ZPL, but it is not meant to be printed unfilled: placeholder text is usually longer than the values it stands for and overflows fixed-width fields (`^FB`). To see the layout, use the designer's preview with sample data.
- The content is an ordered list of bands (SCOPE D8). Coordinates inside a band are relative to the band's top edge; the filler positions every band with `^LH`.
- Placeholders stand for values and are replaced by the filler.
- `ZC:IF` blocks hide elements or bands (SCOPE D9).
- All coordinates and sizes are in printer dots at the template's resolution.

## 3. File Format

- Encoding: UTF-8 without BOM. The printer is switched to UTF-8 with `^CI28`.
- Line endings: LF. Fillers must also accept CRLF.
- Line-oriented: every line is exactly one of the line kinds below. Empty lines may be ignored.

| Line kind | Starts with | Filler action |
|---|---|---|
| Prologue / epilogue | `^XA`, `^CI28`, `^MNN`, `^PW`, `^LL`, `^LH0,0`, `^XZ` | Pass through; rewrite the `^LL` value |
| Marker | `^FX ZC:` | Interpret; may be kept or removed in the output |
| Band offset | `^LH0,` (first line after a `ZC:BAND` marker) | Rewrite with the running offset |
| Element | `^FO` | Replace placeholders; otherwise pass through |

## 4. Structure

```ebnf
template   = "^XA" NL
             "^FX ZC:TEMPLATE spec=1 dpi=" int NL
             "^CI28" NL
             "^MNN" NL
             "^PW" int NL
             "^LL" int NL
             { block }
             "^LH0,0" NL
             "^XZ" [ NL ] ;

block      = band | if-block-of-blocks ;
band       = "^FX ZC:BAND id=" id " height=" int [ " repeat=" path ] NL
             "^LH0," int NL
             { content }
             "^FX ZC:END" NL ;
content    = element | image | grow | if-block-of-content ;

if-block-of-blocks  = if-marker { block }   "^FX ZC:ENDIF" NL ;
if-block-of-content = if-marker { content } "^FX ZC:ENDIF" NL ;
if-marker  = "^FX ZC:IF " path " " ( "notEmpty" | "notZero" ) NL ;

image      = "^FX ZC:IMAGE key=" id " width=" int " height=" int NL element ;
grow       = "^FX ZC:GROW cpl=" int " lines=" int " lineHeight=" int NL element ;
element    = "^FO" { any character except NL } "^FS" NL ;
id         = letter { letter | digit | "_" | "-" } ;
```

Rules:

- Marker attributes are `key=value` pairs separated by one space. Values never contain spaces. Attribute order is not significant; unknown attributes must be ignored.
- Bands are not nested. A band appears at the top level or inside a top-level `ZC:IF` block.
- `ZC:IF` blocks may be nested.
- Every element belongs to a band.
- Every element line starts with `^FO<x>,<y>`.
- A band contains at most one growing element (section 9).
- The `^LL` value in an unfilled template is the sum of all band heights, each band counted once.
- The template ends with `^LH0,0` so that the band offset never leaks into later labels.

## 5. Placeholders

```ebnf
placeholder = "{{" path { "|" option } "}}" ;
path        = [ "$." ] segment { "." segment } ;
segment     = ( letter | "_" ) { letter | digit | "_" } ;   (* letter: any Unicode letter *)
option      = "fmt=" format | "max=" int | "inv" ;
format      = 1*( any character except "|", "}" ) ;
```

Examples: `{{DocNumber}}`, `{{Total|fmt=N2}}`, `{{DocDate|fmt=dd.MM.yyyy}}`, `{{Product.Name|max=28}}`, `{{$.Currency}}`.

### 5.1 Where placeholders appear
- Only inside the field data of a `^FD` command, which is always preceded by `^FH_`.
- A field may contain several placeholders mixed with static text, e.g. `^FH_^FD{{Total|fmt=N2}} {{Currency}}^FS`.
- The designer never emits a literal `{` in static text (it is written as `_7B`), so every `{{…}}` in an element line is a placeholder.

### 5.2 Resolving a value
1. **Context.** Inside a repeating band the path is relative to the current array item. Outside, and for any path that starts with `$.`, it is relative to the document root.
2. **Lookup.** A missing segment or a `null` value gives an empty string.
3. **Conversion.** Strings are used as is. Numbers use the invariant culture (`1200.5`). Booleans become `true` / `false`. Objects and arrays give an empty string.
4. **Format.** If `fmt` is given and the value matches its kind, it is formatted (section 6). Otherwise the converted value is used unformatted.
5. **Truncate.** If `max` is given, the result is cut to its first `max` characters (Unicode code points). No ellipsis is added.
6. **Sanitize.** Control characters (U+0000–U+001F, U+007F) are replaced with a space.
7. **Escape (mandatory).** `^FH` escaping is decoded before the printer interprets the field, so two field types need an extra step first:
   - In a Code 128 field (the line contains `^BC`), replace `>` with `>0`: `^BC` reads `>` plus the next character as a control code.
   - In a field block (the line contains `^FB`), replace `\` with `\\`: `^FB` reads `\&` as a line break and drops a single `\`.

   Then, in every field, replace `_` with `_5F`, `^` with `_5E` and `~` with `_7E`, in this order.

## 6. Formats

A template stores the meaning of a format; the filler applies its own culture (SCOPE D3). The option `inv` forces the invariant culture, e.g. for machine-readable QR content.

### 6.1 Numbers

Applies to JSON numbers and to numeric strings written in the invariant culture (`"1234.5"`). Rounding is half away from zero.

| Code | Meaning | tr-TR (1234.5) | en-US (1234.5) | `inv` |
|---|---|---|---|---|
| `N0`…`N9` | Grouped, n decimals | `N2` → 1.234,50 | 1,234.50 | 1,234.50 |
| `F0`…`F9` | No grouping, n decimals | `F2` → 1234,50 | 1234.50 | 1234.50 |

### 6.2 Dates and times

Applies to ISO 8601 strings (`2026-11-13` or `2026-11-13T14:37:00`, optionally with an offset). The clock time is printed as written; no time-zone conversion is made.

| Code | Meaning | tr-TR | en-US |
|---|---|---|---|
| `d` | Short date | 13.11.2026 | 11/13/2026 |
| `D` | Long date | 13 Kasım 2026 Cuma | Friday, November 13, 2026 |
| `t` | Short time | 14:37 | 2:37 PM |
| `g` | Short date + short time | 13.11.2026 14:37 | 11/13/2026 2:37 PM |

Localized codes follow each platform's culture data, so the exact text can differ slightly between platforms. For an exact result, use a custom pattern.

### 6.3 Custom date patterns

A `fmt` value longer than one character is a custom pattern. It is culture-invariant.

| Token | Meaning | Example |
|---|---|---|
| `yyyy` / `yy` | Year | 2026 / 26 |
| `MM` / `M` | Month | 11 / 11 |
| `dd` / `d` | Day | 13 / 13 |
| `HH` / `H` | Hour (00–23) | 14 / 14 |
| `mm` | Minute | 37 |
| `ss` | Second | 00 |

Any other character is copied literally. Letters other than these tokens must not be used.

### 6.4 Platform equivalents (informative)

| Code | .NET | Java | JavaScript |
|---|---|---|---|
| `N2` | `ToString("N2", culture)` | `NumberFormat.getNumberInstance(locale)`, 2 fraction digits, `RoundingMode.HALF_UP` | `Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` |
| `F2` | `ToString("F2", culture)` | as `N2` with `setGroupingUsed(false)` | as `N2` with `useGrouping: false` |
| `d` | `ToString("d", culture)` | `DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT)` | `Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })` |
| `D` | `ToString("D", culture)` | `ofLocalizedDate(FormatStyle.FULL)` | `{ dateStyle: 'full' }` |
| `t` | `ToString("t", culture)` | `ofLocalizedTime(FormatStyle.SHORT)` | `{ timeStyle: 'short' }` |
| custom | `ToString(pattern, CultureInfo.InvariantCulture)` | `DateTimeFormatter.ofPattern(pattern)` | manual token replacement |

## 7. Conditions

| Operator | True when |
|---|---|
| `notEmpty` | The value exists and is not `null`, not an empty or whitespace-only string, and not an empty array. |
| `notZero` | The value is a number, or a numeric string, that is not zero. Negative values are not zero and are therefore shown. Missing, empty and non-numeric values are false. |

- A condition is evaluated in the context where it appears (inside a repeating band: the current item).
- A `ZC:IF` around a band that is false skips the band; it takes no space.
- A `ZC:IF` inside a band that is false skips its lines; the band keeps its height.

## 8. Images

- **Static images** are embedded in the element line as `^GFA` data. The filler does nothing.
- **Dynamic images** (e.g. a tenant logo supplied at print time) use an image marker followed by one placeholder element that outlines the image area:

  ```zpl
  ^FX ZC:IMAGE key=TenantLogo width=240 height=80
  ^FO168,16^GB240,80,1^FS
  ```

  The filler replaces the element line with the same `^FO` position followed by the image as `^GFA` data, scaled to fit within `width` × `height` dots with its aspect ratio kept and converted to monochrome. If no image is available, the filler removes the element line. Image keys are declared in the field catalog as fields of type `image`; the key is the field path.

## 9. Growing Text

A band normally has a fixed height. The designer can instead mark one text element per band as growing; the band then grows with the number of lines this element needs (SCOPE D5).

```zpl
^FX ZC:GROW cpl=24 lines=3 lineHeight=26
^FO16,8^A0N,22,22^FB360,3,4,L^FH_^FD{{Product.Name}}^FS
```

- `cpl`: maximum characters per line. `lines`: maximum number of lines. `lineHeight`: distance between two lines in dots.
- The element uses `^FB` with at least `lines` lines and a line spacing that matches `lineHeight` (here 22 dots font + 4 dots spacing = 26).
- The band's designed height assumes that the growing element has one line.

After resolving the placeholders, the filler handles the growing element as a whole field instead of value by value:

1. Build the field text unescaped: static text with its `^FH` escapes decoded, values after step 6 of section 5.2.
2. Break it into lines of at most `cpl` characters. Break at spaces; split a word that is longer than `cpl`.
3. Keep at most `lines` lines and drop the rest of the text.
4. Escape each line (section 5.2, step 7) and join the lines with `\&`, the `^FB` line break.
5. `extra = (number of lines − 1) × lineHeight`. Add `extra` to the `y` of every element line in the same band copy whose `y` is greater than the growing element's `y`, and to the height of this band copy.

Line breaks are counted in characters, so they are approximate for proportional fonts. The designer chooses `cpl` so that a full line fits the field width; the preview shows the result with sample data.

## 10. Filling Algorithm (normative)

```text
offset = 0
for each line in prologue:        output line (remember the position of ^LL)
process(blocks at top level, context = root)
output "^LH0,0" and "^XZ"
set the ^LL value to offset

process(blocks, context):
  for each block:
    if ZC:IF   -> if condition(context) then process(inner blocks, context)
    if ZC:BAND -> items = repeat ? array at repeat path in context : [context]
                  for each item:
                    (lines, growY, extra) = processContent(band content, repeat ? item : context)
                    if extra > 0: add extra to the y of every element line with y > growY
                    output "^LH0," + offset, then lines
                    offset += height + extra

processContent(lines, context):
  for each line:
    if ZC:IF    -> if condition(context) then processContent(inner lines, context)
    if ZC:IMAGE -> replace or remove the following element line (section 8)
    if ZC:GROW  -> wrap the following element line (section 9); remember its y and extra
    if element  -> replace every placeholder (section 5)
  return the resulting element lines, growY and extra (0 without a growing element)
```

A repeating band whose array is missing or empty prints nothing and takes no space.

## 11. Limits

- After filling, `^LL` is the sum of the heights of all printed band copies.
- ZPL accepts `^LL` values up to 32000 dots (about 4 m at 203 dpi). Output longer than the printer's maximum length is outside this specification; a filler may split it into several formats.

## 12. Example

Template (203 dpi, 72 mm printable width):

```zpl
^XA
^FX ZC:TEMPLATE spec=1 dpi=203
^CI28
^MNN
^PW576
^LL240
^FX ZC:BAND id=header height=120
^LH0,0
^FO16,16^A0N,28,28^FH_^FD{{Company.Name}}^FS
^FO16,56^A0N,22,22^FH_^FDBelge No: {{DocNumber}}^FS
^FO16,84^A0N,22,22^FH_^FDTarih: {{DocDate|fmt=d}}^FS
^FX ZC:END
^FX ZC:BAND id=lines height=40 repeat=Lines
^LH0,120
^FX ZC:GROW cpl=24 lines=3 lineHeight=26
^FO16,8^A0N,22,22^FB360,3,4,L^FH_^FD{{Product.Name}}^FS
^FO400,8^A0N,22,22^FB160,1,0,R^FH_^FD{{Total|fmt=N2}}^FS
^FX ZC:END
^FX ZC:IF Discount notZero
^FX ZC:BAND id=discount height=32
^LH0,160
^FO16,4^A0N,22,22^FH_^FDİndirim^FS
^FO400,4^A0N,22,22^FB160,1,0,R^FH_^FD{{Discount|fmt=N2}}^FS
^FX ZC:END
^FX ZC:ENDIF
^FX ZC:BAND id=totals height=48
^LH0,192
^FO16,8^A0N,28,28^FH_^FDGenel Toplam^FS
^FO400,8^A0N,28,28^FB160,1,0,R^FH_^FD{{Total|fmt=N2}} {{Currency}}^FS
^FX ZC:END
^LH0,0
^XZ
```

Data:

```json
{
  "Company": { "Name": "Örnek Gıda A.Ş." },
  "DocNumber": "FTR2026000123",
  "DocDate": "2026-11-13T14:37:00",
  "Currency": "TRY",
  "Discount": 0,
  "Total": 2751.5,
  "Lines": [
    { "Product": { "Name": "Süt 1L" }, "Total": 1200.5 },
    { "Product": { "Name": "Peynir_Beyaz ^Tam Yağlı" }, "Total": 1201 },
    { "Product": { "Name": "Tam Yağlı Beyaz Peynir Ezine 1 kg Vakumlu" }, "Total": 350 }
  ]
}
```

Filled output in tr-TR, with marker lines removed. The discount band is skipped because `Discount` is zero, the second product name shows the escaping of `_` and `^`, and the third product name wraps to two lines, so its row grows by 26 dots:

```zpl
^XA
^CI28
^MNN
^PW576
^LL314
^LH0,0
^FO16,16^A0N,28,28^FH_^FDÖrnek Gıda A.Ş.^FS
^FO16,56^A0N,22,22^FH_^FDBelge No: FTR2026000123^FS
^FO16,84^A0N,22,22^FH_^FDTarih: 13.11.2026^FS
^LH0,120
^FO16,8^A0N,22,22^FB360,3,4,L^FH_^FDSüt 1L^FS
^FO400,8^A0N,22,22^FB160,1,0,R^FH_^FD1.200,50^FS
^LH0,160
^FO16,8^A0N,22,22^FB360,3,4,L^FH_^FDPeynir_5FBeyaz _5ETam Yağlı^FS
^FO400,8^A0N,22,22^FB160,1,0,R^FH_^FD1.201,00^FS
^LH0,200
^FO16,8^A0N,22,22^FB360,3,4,L^FH_^FDTam Yağlı Beyaz Peynir\&Ezine 1 kg Vakumlu^FS
^FO400,8^A0N,22,22^FB160,1,0,R^FH_^FD350,00^FS
^LH0,266
^FO16,8^A0N,28,28^FH_^FDGenel Toplam^FS
^FO400,8^A0N,28,28^FB160,1,0,R^FH_^FD2.751,50 TRY^FS
^LH0,0
^XZ
```

## 13. Versioning

- The `spec` attribute of the `ZC:TEMPLATE` marker carries the specification version.
- Additive changes (new marker attributes, new placeholder options) keep the version; fillers ignore what they do not know.
- Breaking changes increase the version. A filler must reject a template whose `spec` is higher than it supports.

## 14. Verification

Checked in Labelary (emulator):

- `^LH` changed in the middle of a format applies only to the fields that follow it.
- `^FH_` escaping works in text, QR (`^BQ`) and Code 128 (`^BC`) data.
- `^CI28` renders Turkish characters (ş ğ ı İ ç ö ü).

Confirmed on the reference printer (ZQ521):

- Turkish characters print with the printer's own fonts.

To check on the first real print (low risk, documented ZPL behavior):

- The closing `^LH0,0` keeps the offset from leaking into the next print; an emulator renders every format in isolation.
- `^MNN` with the filled `^LL` feeds exactly the computed length.