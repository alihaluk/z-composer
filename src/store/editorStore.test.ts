import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorStore } from './editorStore';
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
