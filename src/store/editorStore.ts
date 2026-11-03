import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { temporal, type TemporalState } from 'zundo';
import { DEFAULT_CATALOG, type Catalog } from '../lib/catalog';
import { emptyTemplate, newId, parseTemplate } from '../lib/templateIO';
import { type Band, type PrinterProfile, type Template, type TemplateElement } from '../types';

export interface SavedTemplate {
  name: string;
  template: Template;
  savedAt: string;
}

export interface Selection {
  bandId: string;
  /** Selected elements of the band; empty when the band itself is selected. */
  ids: string[];
}

export type CanvasMode = 'fields' | 'sample';

export interface EditorState {
  template: Template;
  catalog: Catalog;
  templateName: string | null;
  selection: Selection | null;
  zoom: number;
  canvasMode: CanvasMode;
  previewLocale: string;
  savedTemplates: SavedTemplate[];
  clipboard: TemplateElement[];

  setTemplate: (template: Template, name?: string | null) => void;
  setTemplateName: (name: string | null) => void;
  setCatalog: (catalog: Catalog) => void;
  updatePrinter: (patch: Partial<PrinterProfile>) => void;

  addBand: (afterBandId?: string) => void;
  updateBand: (bandId: string, patch: Partial<Omit<Band, 'id' | 'elements'>>) => void;
  removeBand: (bandId: string) => void;
  moveBand: (bandId: string, direction: -1 | 1) => void;

  addElement: (bandId: string, element: TemplateElement) => void;
  updateElement: (bandId: string, id: string, patch: Partial<TemplateElement>) => void;
  updateElements: (bandId: string, patches: Record<string, Partial<TemplateElement>>) => void;
  removeElements: (bandId: string, ids: string[]) => void;
  moveElementToBand: (fromBandId: string, toBandId: string, id: string, patch: Partial<TemplateElement>) => void;
  reorderElement: (bandId: string, id: string, to: 'front' | 'back') => void;

  select: (selection: Selection | null) => void;
  copySelection: () => void;
  paste: (bandId?: string) => void;
  duplicateSelection: () => void;

  setZoom: (zoom: number) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  setPreviewLocale: (locale: string) => void;

  saveTemplate: (name: string) => string | null;
  deleteTemplate: (name: string) => void;
  loadTemplate: (name: string) => void;
}

export interface EditorStoreOptions {
  template?: Template;
  catalog?: Catalog;
  templateName?: string | null;
  locale?: string;
  /** localStorage key for saved templates; null disables local saving. */
  storageKey?: string | null;
}

export type EditorStore = StoreApi<EditorState> & { temporal: StoreApi<TemporalState<{ template: Template }>> };

const PASTE_OFFSET_MM = 2;
const DEFAULT_STORAGE_KEY = 'zcomposer_templates_v2';

/** Storage key of the v1 designer; its templates are migrated once, the old entry is kept. */
const V1_STORAGE_KEY = 'zcomposer_templates';

// Storage can be missing or blocked (private mode, sandboxed iframes); reads never throw.
function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJsonArray(key: string): unknown[] {
  try {
    const parsed = JSON.parse(storageGet(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSaved(key: string | null): SavedTemplate[] {
  if (!key) return [];
  const saved = readJsonArray(key).filter((t): t is SavedTemplate => {
    const entry = t as Partial<SavedTemplate> | null;
    return !!entry && typeof entry.name === 'string' && entry.template?.schemaVersion === 2;
  });
  if (storageGet(key) === null && key === DEFAULT_STORAGE_KEY) {
    for (const old of readJsonArray(V1_STORAGE_KEY) as { name?: unknown; data?: unknown; createdAt?: string }[]) {
      try {
        if (typeof old?.name === 'string') saved.push({ name: old.name, template: parseTemplate(old.data), savedAt: old.createdAt ?? new Date().toISOString() });
      } catch {
        // A broken v1 entry is skipped; it stays in the old storage key.
      }
    }
    if (saved.length) writeSaved(key, saved);
  }
  return saved;
}

function writeSaved(key: string | null, templates: SavedTemplate[]): string | null {
  if (!key) return null;
  try {
    localStorage.setItem(key, JSON.stringify(templates));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Storage is not available';
  }
}

const mapBand = (template: Template, bandId: string, fn: (band: Band) => Band): Template => ({
  ...template,
  bands: template.bands.map(b => (b.id === bandId ? fn(b) : b)),
});

const cloneElements = (elements: TemplateElement[], offset: number) =>
  elements.map(el => ({ ...structuredClone(el), id: newId(), x: el.x + offset, y: el.y + offset }));

export function createEditorStore(options: EditorStoreOptions = {}): EditorStore {
  const storageKey = options.storageKey === undefined ? DEFAULT_STORAGE_KEY : options.storageKey;

  return createStore<EditorState>()(
    temporal(
      (set, get) => ({
        template: options.template ?? emptyTemplate(),
        catalog: options.catalog ?? DEFAULT_CATALOG,
        templateName: options.templateName ?? null,
        selection: null,
        zoom: 1.5,
        canvasMode: 'fields',
        previewLocale: options.locale ?? 'tr-TR',
        savedTemplates: readSaved(storageKey),
        clipboard: [],

        setTemplate: (template, name = null) => set({ template, templateName: name, selection: null }),
        setTemplateName: (templateName) => set({ templateName }),
        setCatalog: (catalog) => set({ catalog }),
        updatePrinter: (patch) => set(s => ({ template: { ...s.template, printer: { ...s.template.printer, ...patch } } })),

        addBand: (afterBandId) => set(s => {
          const band: Band = { id: newId('b'), name: `Band ${s.template.bands.length + 1}`, height: 10, elements: [] };
          const index = afterBandId ? s.template.bands.findIndex(b => b.id === afterBandId) + 1 : s.template.bands.length;
          const bands = [...s.template.bands];
          bands.splice(index, 0, band);
          return { template: { ...s.template, bands }, selection: { bandId: band.id, ids: [] } };
        }),
        updateBand: (bandId, patch) => set(s => ({ template: mapBand(s.template, bandId, b => ({ ...b, ...patch })) })),
        removeBand: (bandId) => set(s => ({
          template: { ...s.template, bands: s.template.bands.filter(b => b.id !== bandId) },
          selection: s.selection?.bandId === bandId ? null : s.selection,
        })),
        moveBand: (bandId, direction) => set(s => {
          const bands = [...s.template.bands];
          const i = bands.findIndex(b => b.id === bandId);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= bands.length) return {};
          [bands[i], bands[j]] = [bands[j], bands[i]];
          return { template: { ...s.template, bands } };
        }),

        addElement: (bandId, element) => set(s => ({
          template: mapBand(s.template, bandId, b => ({ ...b, elements: [...b.elements, element] })),
          selection: { bandId, ids: [element.id] },
        })),
        updateElement: (bandId, id, patch) => set(s => ({
          template: mapBand(s.template, bandId, b => ({ ...b, elements: b.elements.map(el => (el.id === id ? { ...el, ...patch } : el)) })),
        })),
        updateElements: (bandId, patches) => set(s => ({
          template: mapBand(s.template, bandId, b => ({ ...b, elements: b.elements.map(el => (patches[el.id] ? { ...el, ...patches[el.id] } : el)) })),
        })),
        removeElements: (bandId, ids) => set(s => ({
          template: mapBand(s.template, bandId, b => ({ ...b, elements: b.elements.filter(el => !ids.includes(el.id)) })),
          selection: s.selection?.bandId === bandId ? { bandId, ids: s.selection.ids.filter(id => !ids.includes(id)) } : s.selection,
        })),
        moveElementToBand: (fromBandId, toBandId, id, patch) => set(s => {
          const element = s.template.bands.find(b => b.id === fromBandId)?.elements.find(el => el.id === id);
          if (!element) return {};
          const removed = mapBand(s.template, fromBandId, b => ({ ...b, elements: b.elements.filter(el => el.id !== id) }));
          return {
            template: mapBand(removed, toBandId, b => ({ ...b, elements: [...b.elements, { ...element, ...patch }] })),
            selection: { bandId: toBandId, ids: [id] },
          };
        }),
        reorderElement: (bandId, id, to) => set(s => ({
          template: mapBand(s.template, bandId, b => {
            const element = b.elements.find(el => el.id === id);
            if (!element) return b;
            const rest = b.elements.filter(el => el.id !== id);
            return { ...b, elements: to === 'front' ? [...rest, element] : [element, ...rest] };
          }),
        })),

        select: (selection) => set({ selection }),
        copySelection: () => {
          const { selection, template } = get();
          if (!selection?.ids.length) return;
          const band = template.bands.find(b => b.id === selection.bandId);
          set({ clipboard: structuredClone(band?.elements.filter(el => selection.ids.includes(el.id)) ?? []) });
        },
        paste: (bandId) => {
          const { clipboard, selection, template } = get();
          const target = bandId ?? selection?.bandId ?? template.bands[0]?.id;
          if (!clipboard.length || !target) return;
          const copies = cloneElements(clipboard, PASTE_OFFSET_MM);
          set(s => ({
            template: mapBand(s.template, target, b => ({ ...b, elements: [...b.elements, ...copies] })),
            selection: { bandId: target, ids: copies.map(c => c.id) },
            clipboard: copies,
          }));
        },
        duplicateSelection: () => {
          get().copySelection();
          get().paste();
        },

        setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(4, zoom)) }),
        setCanvasMode: (canvasMode) => set({ canvasMode }),
        setPreviewLocale: (previewLocale) => set({ previewLocale }),

        saveTemplate: (name) => {
          const { template, savedTemplates } = get();
          const updated = [...savedTemplates.filter(t => t.name !== name), { name, template, savedAt: new Date().toISOString() }];
          const error = writeSaved(storageKey, updated);
          if (!error) set({ savedTemplates: updated, templateName: name });
          return error;
        },
        deleteTemplate: (name) => {
          const updated = get().savedTemplates.filter(t => t.name !== name);
          writeSaved(storageKey, updated);
          set(s => ({ savedTemplates: updated, templateName: s.templateName === name ? null : s.templateName }));
        },
        loadTemplate: (name) => {
          const saved = get().savedTemplates.find(t => t.name === name);
          if (saved) set({ template: structuredClone(saved.template), templateName: name, selection: null });
        },
      }),
      {
        partialize: (state) => ({ template: state.template }),
        // Only template changes create undo steps; selection, zoom and so on do not.
        equality: (past, current) => past.template === current.template,
        limit: 100,
      },
    ),
  ) as EditorStore;
}

export const EditorStoreContext = createContext<EditorStore | null>(null);

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('Z-Composer components must be rendered inside <ZComposer> or an EditorStoreContext provider');
  return store;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}

export function useSelectedBand(): Band | undefined {
  return useEditor(s => s.template.bands.find(b => b.id === s.selection?.bandId));
}

export function useSelectedElements(): TemplateElement[] {
  return useEditor(useShallow(s => {
    const band = s.template.bands.find(b => b.id === s.selection?.bandId);
    return band?.elements.filter(el => s.selection?.ids.includes(el.id)) ?? [];
  }));
}
