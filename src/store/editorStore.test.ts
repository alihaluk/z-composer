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
