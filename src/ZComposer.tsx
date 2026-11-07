import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { DndContext, MouseSensor, TouchSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Editor } from './components/Editor';
import { DesignIssuesProvider } from './components/DesignCheck';
import { PropertiesPanel } from './components/PropertiesPanel';
import { createI18n, defaultLocale, type Language } from './i18n';
import { type Catalog } from './lib/catalog';
import { loadGrayBitmap } from './lib/imageUtils';
import { emptyTemplate, withFieldsUsed } from './lib/templateIO';
import { bandNames } from './lib/bandNames';
import { generateTemplateZpl } from './lib/zplTemplate';
import { cn } from './lib/utils';
import { createEditorStore, EditorStoreContext, type EditorStore } from './store/editorStore';
import { type Template } from './types';

export interface ZComposerSaveResult {
  /** The template with its `fieldsUsed` snapshot. */
  template: Template;
  /** The ZPL template (docs/OUTPUT_SPEC.md). */
  zpl: string;
}

export interface ZComposerProps {
  /** Template to edit. Passing a different object later replaces the design. */
  template?: Template;
  /** Field catalog. Passing a different object later replaces it. */
  catalog?: Catalog;
  /** Interface language; detected from the browser when omitted. */
  language?: Language;
  /** Culture for sample values on the canvas and in the preview, e.g. "tr-TR". */
  locale?: string;
  /** localStorage key for the saved-templates list; null hides the list. */
  storageKey?: string | null;
  /** Whether users can import, edit and replace the catalog. Defaults to true. */
  catalogEditable?: boolean;
  /** Called after every change of the template. */
  onChange?: (template: Template) => void;
  /** Shows a Save button that hands the template and its ZPL to the host. */
  onSave?: (result: ZComposerSaveResult) => void;
  className?: string;
}

/** Templates migrated from v1 carry their uploaded image but no bitmap for ZPL output yet. */
function useBitmapRepair(store: EditorStore) {
  useEffect(() => {
    const pending = new Set<string>();
    const repair = () => {
      const { template, updateElement } = store.getState();
      for (const band of template.bands) {
        for (const el of band.elements) {
          if (el.type !== 'image' || !el.imageBase64 || el.bitmap || el.imageKey || pending.has(el.id)) continue;
          pending.add(el.id);
          loadGrayBitmap(el.imageBase64).then(({ bitmap }) => updateElement(band.id, el.id, { bitmap })).catch(() => undefined);
        }
      }
    };
    repair();
    return store.subscribe((s, prev) => { if (s.template !== prev.template) repair(); });
  }, [store]);
}

/** The root element carries the interface language, so upper-case titles follow its rules (i → İ in Turkish). */
function LanguageRoot({ className, children }: { className: string; children: ReactNode }) {
  const { i18n } = useTranslation();
  return <div lang={i18n.resolvedLanguage} className={className}>{children}</div>;
}

export function ZComposer({ template, catalog, language, locale, storageKey, catalogEditable = true, onChange, onSave, className }: ZComposerProps) {
  const [i18n] = useState(() => createI18n(language));
  const [store] = useState(() => createEditorStore({ template, emptyTemplate: emptyTemplate(bandNames(i18n.t)), catalog, storageKey, locale, defaultLocale: defaultLocale(i18n.resolvedLanguage) }));
  useBitmapRepair(store);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));

  useEffect(() => { if (language && i18n.resolvedLanguage !== language) void i18n.changeLanguage(language); }, [i18n, language]);
  useEffect(() => { if (locale) store.getState().setPreviewLocale(locale); }, [store, locale]);
  useEffect(() => { if (template && template !== store.getState().template) store.getState().setTemplate(template); }, [store, template]);
  useEffect(() => { if (catalog && catalog !== store.getState().catalog) store.getState().setCatalog(catalog); }, [store, catalog]);

  useEffect(() => {
    if (!onChange) return;
    return store.subscribe((s, prev) => { if (s.template !== prev.template) onChange(s.template); });
  }, [store, onChange]);

  const save = onSave && (() => {
    const { template: current, catalog: currentCatalog } = store.getState();
    onSave({ template: withFieldsUsed(current, currentCatalog), zpl: generateTemplateZpl(current) });
  });

  return (
    <I18nextProvider i18n={i18n}>
      <EditorStoreContext.Provider value={store}>
        <LanguageRoot className={cn('zc-root h-full', className)}>
          {/* One drag context for the whole designer: tools are dragged from the sidebar onto the canvas. */}
          <DndContext sensors={sensors} collisionDetection={pointerWithin}>
            <DesignIssuesProvider>
              <div className="flex h-full min-h-0 flex-col">
                <TopBar catalogEditable={catalogEditable} showLanguageSwitch={!language} onSave={save} />
                <div className="min-h-0 flex-1">
                  <Layout sidebar={<Sidebar allowLocalTemplates={storageKey !== null} catalogEditable={catalogEditable} />} propertiesPanel={<PropertiesPanel />}>
                    <Editor catalogEditable={catalogEditable} />
                  </Layout>
                </div>
              </div>
            </DesignIssuesProvider>
          </DndContext>
        </LanguageRoot>
      </EditorStoreContext.Provider>
    </I18nextProvider>
  );
}
