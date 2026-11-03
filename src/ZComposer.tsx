import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { PropertiesPanel } from './components/PropertiesPanel';
import { loadGrayBitmap } from './lib/imageUtils';
import { createEditorStore, EditorStoreContext, type EditorStore, type EditorStoreOptions } from './store/editorStore';
import { type Template } from './types';

export interface ZComposerProps extends EditorStoreOptions {
  /** Called after every change of the template. */
  onChange?: (template: Template) => void;
}

/** Templates migrated from v1 carry their uploaded image but no bitmap for ZPL output yet. */
function useBitmapRepair(store: EditorStore) {
  useEffect(() => {
    const repair = () => {
      const { template, updateElement } = store.getState();
      for (const band of template.bands) {
        for (const el of band.elements) {
          if (el.type === 'image' && el.imageBase64 && !el.bitmap && !el.imageKey) {
            loadGrayBitmap(el.imageBase64).then(({ bitmap }) => updateElement(band.id, el.id, { bitmap })).catch(() => undefined);
          }
        }
      }
    };
    repair();
    return store.subscribe((s, prev) => { if (s.template !== prev.template) repair(); });
  }, [store]);
}

export function ZComposer({ onChange, ...options }: ZComposerProps) {
  const [store] = useState(() => createEditorStore(options));
  useBitmapRepair(store);

  useEffect(() => {
    if (!onChange) return;
    return store.subscribe((s, prev) => { if (s.template !== prev.template) onChange(s.template); });
  }, [store, onChange]);

  return (
    <EditorStoreContext.Provider value={store}>
      <Layout sidebar={<Sidebar allowLocalTemplates={options.storageKey !== null} />} propertiesPanel={<PropertiesPanel />}>
        <Editor />
      </Layout>
    </EditorStoreContext.Provider>
  );
}
