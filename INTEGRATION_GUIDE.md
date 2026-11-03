# Integration Guide

Z-Composer can be embedded into a React application (React 18 or 19). The host decides where templates and catalogs are stored; the designer hands them over through callbacks.

## 1. Build the package

```bash
npm install
npm run build:lib
```

This writes `dist-lib/`: an ES module (`z-composer.js`), a stylesheet (`style.css`), type declarations (`types/`) and a barcode chunk that is loaded on demand. React and React DOM are peer dependencies and are not bundled.

The package is marked `private` in `package.json`, so it is not published by accident. Install it from a path, a Git URL or a tarball (`npm pack` builds the library first through the `prepack` script), for example:

```bash
npm install ../z-composer
```

To publish it to a registry, remove `"private": true` and run `npm publish`.

## 2. Embed the designer

```tsx
import { ZComposer, type Catalog, type Template } from 'z-composer';
import 'z-composer/style.css';

export function TemplateDesigner({ template, catalog, onSaved }: {
  template?: Template;
  catalog: Catalog;
  onSaved: (template: Template, zpl: string) => void;
}) {
  return (
    <div style={{ height: '80vh' }}>
      <ZComposer
        template={template}
        catalog={catalog}
        language="tr"
        locale="tr-TR"
        storageKey={null}
        catalogEditable={false}
        onSave={({ template, zpl }) => onSaved(template, zpl)}
      />
    </div>
  );
}
```

The designer fills its container; give the container a height.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `template` | `Template` | empty template | Template to edit. Passing a different object later replaces the design. |
| `catalog` | `Catalog` | generic invoice catalog | Fields the template can bind to. Passing a different object later replaces it. |
| `language` | `'tr' \| 'en'` | detected | Interface language. |
| `locale` | `string` | follows `language` | Culture used to show sample values, e.g. `tr-TR`. It is not stored in the template. |
| `storageKey` | `string \| null` | `zcomposer_templates_v2` | `localStorage` key for the built-in saved-templates list; `null` hides the list. |
| `catalogEditable` | `boolean` | `true` | Whether users can import, edit or replace the catalog. |
| `onChange` | `(template) => void` | — | Called after every change of the template. |
| `onSave` | `({ template, zpl }) => void` | — | Shows a Save button. `template` carries the `fieldsUsed` snapshot; `zpl` is the ZPL template. |
| `className` | `string` | — | Extra class for the root element. |

Each `ZComposer` has its own state and its own i18next instance, so several designers can live on one page and the host's translations are not touched.

### Styles

`style.css` contains no global reset: every rule is scoped to the designer's root element (`.zc-root`), so the host page keeps its own styles.

## 3. Catalogs

A catalog describes the data a template binds to: field paths, types, labels and optional sample data for previews (see [SCOPE.md](./docs/SCOPE.md), D2). Build one from your data structure:

```ts
import { catalogFromJsonSchema, catalogFromSample, parseCatalog } from 'z-composer';

// From an example document (it also becomes the preview data):
const { catalog, skipped } = catalogFromSample(exampleInvoice, 'Invoice');

// From a JSON Schema, e.g. generated from a .NET or Java DTO:
const fromSchema = catalogFromJsonSchema(invoiceSchema, 'Invoice').catalog;

// From a saved catalog file:
const saved = parseCatalog(JSON.parse(text));
```

Arrays of objects (for example `Lines`) can drive repeating bands; arrays inside array items are not supported.

## 4. Templates and output

```ts
import { fillTemplate, generateTemplateZpl, parseTemplate } from 'z-composer';

const template = parseTemplate(JSON.parse(storedJson)); // also migrates v1 templates
const zplTemplate = generateTemplateZpl(template);      // docs/OUTPUT_SPEC.md
```

Printing is outside Z-Composer's scope. The [output specification](./docs/OUTPUT_SPEC.md) defines how to fill a ZPL template in any language. `fillTemplate` is the reference implementation in TypeScript, used by the designer's preview. A filler written in another language can be checked against the [conformance suite](./conformance/README.md):

```ts
const zpl = fillTemplate(zplTemplate, invoiceData, { locale: 'tr-TR' });
```
