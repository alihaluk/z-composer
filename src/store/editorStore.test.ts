import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorStore, designStatus, validSelection } from './editorStore';
import { invoicePreset } from '../lib/presets';
import { emptyTemplate } from '../lib/templateIO';
import { type Template } from '../types';

const template = (): Template => ({
  schemaVersion: 2,
  printer: { widthMm: 72, dpi: 203 },
  bands: [
    { id: 'a', name: 'A', height: 10, elements: [{ id: 'x', type: 'text', x: 1, y: 1, width: 10, height: 3, content: 'x' }] },
    { id: 'b', name: 'B', height: 10, elements: [] },
  ],
});

const store = () => createEditorStore({ template: template(), storageKey: null });

describe('editor store', () => {
  it('records undo steps only for template changes', () => {
    const s = store();
    s.getState().select({ bandId: 'a', ids: ['x'] });
    s.getState().setZoom(2);
    expect(s.temporal.getState().pastStates).toHaveLength(0);
    s.getState().updateElement('a', 'x', { x: 5 });
    expect(s.temporal.getState().pastStates).toHaveLength(1);
    s.temporal.getState().undo();
    expect(s.getState().template.bands[0].elements[0].x).toBe(1);
  });

  it('moves an element to another band and selects it there', () => {
    const s = store();
    s.getState().moveElementToBand('a', 'b', 'x', { y: 2 });
    const { template, selection } = s.getState();
    expect(template.bands[0].elements).toHaveLength(0);
    expect(template.bands[1].elements[0]).toMatchObject({ id: 'x', y: 2 });
    expect(selection).toEqual({ bandId: 'b', ids: ['x'] });
  });

  it('pastes copies with new ids, offset each time', () => {
    const s = store();
    s.getState().select({ bandId: 'a', ids: ['x'] });
    s.getState().copySelection();
    s.getState().paste();
    s.getState().paste();
    const els = s.getState().template.bands[0].elements;
    expect(els.map(e => e.x)).toEqual([1, 3, 5]);
    expect(new Set(els.map(e => e.id)).size).toBe(3);
  });

  describe('selection across bands', () => {
    const twoBands = () => {
      const s = store();
      s.getState().addElement('b', { id: 'y', type: 'text', x: 2, y: 2, width: 10, height: 3, content: 'y' });
      s.getState().select({ bandId: 'b', ids: ['x', 'y'] });
      return s;
    };

    it('moves and deletes elements of several bands in one undo step', () => {
      const s = twoBands();
      const steps = s.temporal.getState().pastStates.length;
      s.getState().patchElements({ x: { x: 4 }, y: { x: 5 } });
      expect(s.getState().template.bands.map(b => b.elements[0].x)).toEqual([4, 5]);
      s.getState().deleteElements(['x', 'y']);
      expect(s.getState().template.bands.every(b => b.elements.length === 0)).toBe(true);
      expect(s.getState().selection).toEqual({ bandId: 'b', ids: [] });
      expect(s.temporal.getState().pastStates.length).toBe(steps + 2);
    });

    it('duplicates every element into its own band', () => {
      const s = twoBands();
      s.getState().duplicateSelection();
      const [a, b] = s.getState().template.bands;
      expect(a.elements).toHaveLength(2);
      expect(b.elements).toHaveLength(2);
      expect(s.getState().selection?.ids).toEqual([a.elements[1].id, b.elements[1].id]);
    });

    it('copies elements of all selected bands', () => {
      const s = twoBands();
      s.getState().copySelection();
      expect(s.getState().clipboard.map(el => el.id)).toEqual(['x', 'y']);
    });

    it('drops the elements of a removed band from the selection', () => {
      const s = twoBands();
      s.getState().removeBand('a');
      expect(s.getState().selection).toEqual({ bandId: 'b', ids: ['y'] });
    });
  });

  it('clears the selection when its band is removed', () => {
    const s = store();
    s.getState().select({ bandId: 'a', ids: ['x'] });
    s.getState().removeBand('a');
    expect(s.getState().selection).toBeNull();
  });
});

describe('saved templates', () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeStorage = (initial: Record<string, string>) => {
    const data = new Map(Object.entries(initial));
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it('migrates templates saved by the v1 designer', () => {
    const storage = fakeStorage({
      zcomposer_templates: JSON.stringify([
        { name: 'Old', data: { header: { height: 40, elements: [] }, body: { height: 10, elements: [] }, footer: { height: 20, elements: [] }, canvasWidth: 80 } },
        { name: 'Broken', data: { nope: true } },
      ]),
    });
    vi.stubGlobal('localStorage', storage);
    const s = createEditorStore();
    expect(s.getState().savedTemplates.map(t => t.name)).toEqual(['Old']);
    expect(s.getState().savedTemplates[0].template.printer.widthMm).toBe(80);
    expect(storage.data.has('zcomposer_templates_v2')).toBe(true);
  });

  it('works without storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const s = createEditorStore();
    expect(s.getState().savedTemplates).toEqual([]);
    expect(s.getState().saveTemplate('x')).toBe('blocked');
  });
});

describe('preview culture', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is remembered unless the host fixes it', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    createEditorStore({ defaultLocale: 'en-US' }).getState().setPreviewLocale('de-DE');
    expect(createEditorStore({ defaultLocale: 'en-US' }).getState().previewLocale).toBe('de-DE');
    expect(createEditorStore({ locale: 'fr-FR' }).getState().previewLocale).toBe('fr-FR');
    expect(createEditorStore({ storageKey: null, defaultLocale: 'en-US' }).getState().previewLocale).toBe('en-US');
  });
});

describe('draft', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  const memoryStorage = () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    return data;
  };

  it('reopens the last design and its name after a reload', () => {
    memoryStorage();
    vi.useFakeTimers();
    const first = createEditorStore();
    first.getState().setTemplate(template(), 'Fatura');
    vi.runAllTimers();
    const reopened = createEditorStore().getState();
    expect(reopened.template.bands.map(b => b.id)).toEqual(['a', 'b']);
    expect(reopened.templateName).toBe('Fatura');
  });

  it('is not used when the host passes a template or disables storage', () => {
    memoryStorage();
    vi.useFakeTimers();
    createEditorStore().getState().setTemplate(template());
    vi.runAllTimers();
    const own = { ...template(), bands: [] };
    expect(createEditorStore({ template: own }).getState().template).toBe(own);
    expect(createEditorStore({ storageKey: null }).getState().template.bands).toHaveLength(3);
  });

  it('ignores a draft that is not a valid template', () => {
    memoryStorage().set('zcomposer_templates_v2_draft', '{"template":{"bands":"x"}}');
    expect(createEditorStore().getState().template.bands).toHaveLength(3);
  });
});

describe('design status', () => {
  const box = { id: 'x', type: 'box' as const, x: 0, y: 0, width: 5, height: 5 };
  const make = () => createEditorStore({ storageKey: null, template: emptyTemplate() });
  const status = (s: ReturnType<typeof make>) => designStatus(s.getState());
  // storageKey null skips the browser storage, not the list in the store.
  const first = (s: ReturnType<typeof make>) => s.getState().template.bands[0].id;

  it('goes untitled, saved, modified and back', () => {
    const s = make();
    expect(status(s)).toBe('untitled');
    s.getState().saveTemplate('A');
    expect(status(s)).toBe('saved');
    s.getState().addElement(first(s), box);
    expect(status(s)).toBe('modified');
    s.temporal.getState().undo();
    expect(status(s)).toBe('saved');
    s.temporal.getState().redo();
    s.getState().saveTemplate('A');
    expect(status(s)).toBe('saved');
  });

  it('does not take a design with a saved name for the saved template', () => {
    const s = make();
    s.getState().saveTemplate('e-Fatura');
    s.getState().setTemplate(invoicePreset(), 'e-Fatura');
    expect(s.getState().savedAs).toBeNull();
    expect(status(s)).toBe('named');
  });

  it('restores the name and the saved template with undo', () => {
    const s = make();
    s.getState().saveTemplate('Mine');
    s.getState().setTemplate(invoicePreset(), 'e-Fatura');
    s.temporal.getState().undo();
    expect(s.getState().templateName).toBe('Mine');
    expect(s.getState().savedAs).toBe('Mine');
    expect(status(s)).toBe('saved');
    s.temporal.getState().redo();
    expect(s.getState().templateName).toBe('e-Fatura');
  });

  it('forgets a deleted saved template', () => {
    const s = make();
    s.getState().saveTemplate('A');
    s.getState().deleteTemplate('A');
    expect(s.getState().savedAs).toBeNull();
    expect(status(s)).toBe('untitled');
  });
});

describe('selection after undo and redo', () => {
  const box = { id: 'x', type: 'box' as const, x: 0, y: 0, width: 5, height: 5 };

  it('drops a band and elements that are gone, and redo still works', () => {
    const s = createEditorStore({ storageKey: null, template: emptyTemplate() });
    s.getState().addBand();
    const added = s.getState().template.bands.at(-1)!.id;
    s.getState().addElement(added, box);
    expect(s.getState().selection).toEqual({ bandId: added, ids: ['x'] });

    s.temporal.getState().undo();
    expect(s.getState().selection).toEqual({ bandId: added, ids: [] });
    s.temporal.getState().undo();
    expect(s.getState().selection).toBeNull();

    s.temporal.getState().redo();
    s.temporal.getState().redo();
    expect(s.getState().template.bands.at(-1)!.elements).toHaveLength(1);
  });

  it('keeps the band of what is left and leaves a valid selection untouched', () => {
    const template = emptyTemplate();
    template.bands[1].elements.push(box);
    const gone = { bandId: 'gone', ids: ['x', 'y'] };
    expect(validSelection(gone, template)).toEqual({ bandId: template.bands[1].id, ids: ['x'] });
    const valid = { bandId: template.bands[0].id, ids: ['x'] };
    expect(validSelection(valid, template)).toBe(valid);
    expect(validSelection({ bandId: 'gone', ids: ['y'] }, template)).toBeNull();
  });
});
