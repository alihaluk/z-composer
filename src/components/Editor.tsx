import { useEffect, useMemo, useRef, useState } from 'react';
import { DragOverlay, useDndMonitor, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { mmToPx, pxToMm } from '../lib/constants';
import { sampleGrowth } from '../lib/elementDisplay';
import { snapPosition, type Guide } from '../lib/snapping';
import { fitZoom } from '../lib/zoom';
import { invoicePreset } from '../lib/presets';
import { presetBandNames } from '../lib/bandNames';
import { Button } from './ui/Button';
import { Maximize, Minus, Plus } from 'lucide-react';
import { createElement, type ToolType } from '../lib/tools';
import { useEditor, useEditorStore, type EditorStore } from '../store/editorStore';
import { type TemplateElement } from '../types';
import { BandView } from './BandView';

interface Drop {
  bandId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  guides: Guide[];
}

type DragData = { type: 'tool'; tool: ToolType } | { type: 'element'; bandId: string; id: string };

const KEY_STEP_MM = 0.5;

const KEY_STEP_LARGE_MM = 5;

const isTyping = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement | null)?.isContentEditable;
};

function useKeyboard(store: EditorStore) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Shortcuts act on the canvas; a modal dialog has the keyboard while it is open.
      if (isTyping() || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const s = store.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) store.temporal.getState().redo(); else store.temporal.getState().undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); store.temporal.getState().redo(); return; }
      if (mod && key === 'c') { s.copySelection(); return; }
      if (mod && key === 'v') { e.preventDefault(); s.paste(); return; }
      if (mod && key === 'd') { e.preventDefault(); s.duplicateSelection(); return; }
      if (e.key === 'Escape') { s.select(null); return; }

      const sel = s.selection;
      if (!sel?.ids.length) return;
      const movable = s.template.bands.flatMap(b => b.elements).filter(el => sel.ids.includes(el.id) && !el.locked);
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteElements(movable.map(el => el.id));
        return;
      }
      const step = e.shiftKey ? KEY_STEP_LARGE_MM : KEY_STEP_MM;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!delta || !movable.length) return;
      e.preventDefault();
      const round = (v: number) => Math.round(v * 100) / 100;
      s.patchElements(Object.fromEntries(movable.map(el => [el.id, { x: round(Math.max(0, el.x + delta[0])), y: round(Math.max(0, el.y + delta[1])) }])));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}

export function Editor() {
  const { t } = useTranslation();
  const store = useEditorStore();
  const template = useEditor(s => s.template);
  const zoom = useEditor(s => s.zoom);
  const [drag, setDrag] = useState<DragData | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  useKeyboard(store);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = template.bands.every(b => b.elements.length === 0);
  const widthPx = mmToPx(template.printer.widthMm);

  // On first show, zoom so that the page and its band labels fit the canvas area.
  useEffect(() => {
    const area = scrollRef.current?.parentElement;
    if (!area) return;
    const fit = fitZoom(area.clientWidth, widthPx);
    if (fit < store.getState().zoom) store.getState().setZoom(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once, the user controls zoom afterwards
  }, []);

  const catalog = useEditor(s => s.catalog);
  const mode = useEditor(s => s.canvasMode);
  const locale = useEditor(s => s.previewLocale);
  // In sample mode bands grow with their growing text, like in print.
  const growth = useMemo(() => template.bands.map(b => sampleGrowth(b, catalog, mode, locale, template.printer.dpi)), [template, catalog, mode, locale]);
  const shownOffset = (bandIndex: number, y: number) => {
    const g = growth[bandIndex];
    return g && g.extraMm > 0 && y > g.growY ? g.extraMm : 0;
  };
  const bandTops: number[] = [];
  template.bands.forEach((_, i) => bandTops.push(i === 0 ? 0 : bandTops[i - 1] + template.bands[i - 1].height + growth[i - 1].extraMm));

  const computeDrop = (e: DragMoveEvent | DragEndEvent): Drop | null => {
    const data = e.active.data.current as DragData | undefined;
    const targetId = (e.over?.data.current as { bandId?: string } | undefined)?.bandId;
    const targetIndex = template.bands.findIndex(b => b.id === targetId);
    if (!data || targetIndex < 0) return null;
    const target = template.bands[targetIndex];

    let box: { x: number; y: number; width: number; height: number };
    let ignore: string[] = [];
    if (data.type === 'tool') {
      const rect = e.active.rect.current.translated;
      if (!rect || !e.over) return null;
      const el = createElement(data.tool, 0, 0, template.printer.widthMm);
      box = { x: pxToMm((rect.left - e.over.rect.left) / zoom), y: pxToMm((rect.top - e.over.rect.top) / zoom), width: el.width, height: el.height };
    } else {
      const sourceIndex = template.bands.findIndex(b => b.id === data.bandId);
      const el = template.bands[sourceIndex]?.elements.find(x => x.id === data.id);
      if (!el) return null;
      // Positions are compared on the whole page as shown, then made relative to the target band.
      const pageY = bandTops[sourceIndex] + el.y + shownOffset(sourceIndex, el.y) + pxToMm(e.delta.y / zoom);
      box = { x: el.x + pxToMm(e.delta.x / zoom), y: pageY - bandTops[targetIndex], width: el.width, height: el.height };
      ignore = [el.id];
    }
    // Below a grown text the canvas shows elements lower than they are stored.
    const g = growth[targetIndex];
    if (g.extraMm > 0 && box.y > g.growY + g.extraMm) box = { ...box, y: box.y - g.extraMm };
    const others = target.elements.filter(o => !ignore.includes(o.id));
    const snapped = snapPosition(box, others, template.printer.widthMm, target.height);
    return { bandId: target.id, ...snapped, width: box.width, height: box.height };
  };

  const onStart = (e: DragStartEvent) => setDrag((e.active.data.current as DragData) ?? null);
  const onMove = (e: DragMoveEvent) => setDrop(computeDrop(e));
  const onEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined;
    const result = computeDrop(e);
    setDrag(null);
    setDrop(null);
    if (!data || !result) return;
    const s = store.getState();
    if (data.type === 'tool') {
      s.addElement(result.bandId, createElement(data.tool, result.x, result.y, template.printer.widthMm, t('tools.defaultText')));
      return;
    }
    // Moving one of several selected elements moves them all by the same distance.
    const group = s.selection?.ids.includes(data.id) ? s.selection.ids : [data.id];
    if (data.bandId !== result.bandId && group.length === 1) {
      s.moveElementToBand(data.bandId, result.bandId, data.id, { x: result.x, y: result.y });
      return;
    }
    const moved = s.template.bands.find(b => b.id === data.bandId)!.elements.find(el => el.id === data.id)!;
    // A group keeps its bands; dropped on another band it moves by the distance dragged.
    const sameBand = data.bandId === result.bandId;
    const dx = sameBand ? result.x - moved.x : pxToMm(e.delta.x / zoom);
    const dy = sameBand ? result.y - moved.y : pxToMm(e.delta.y / zoom);
    const patches: Record<string, Partial<TemplateElement>> = {};
    for (const el of s.template.bands.flatMap(b => b.elements)) {
      if (!group.includes(el.id) || el.locked) continue;
      patches[el.id] = { x: Math.round(Math.max(0, el.x + dx) * 100) / 100, y: Math.round(Math.max(0, el.y + dy) * 100) / 100 };
    }
    s.patchElements(patches);
    if (group.length === 1) s.select({ bandId: data.bandId, ids: [data.id] });
  };

  // The drag context is ZComposer's, so tools of the sidebar can be dragged onto the canvas too.
  useDndMonitor({ onDragStart: onStart, onDragMove: onMove, onDragEnd: onEnd, onDragCancel: () => { setDrag(null); setDrop(null); } });

  const dropBandIndex = drop ? template.bands.findIndex(b => b.id === drop.bandId) : -1;

  return (
    <>
      {/* w-max + mx-auto centres the page but keeps all of it reachable by scrolling when it is wider. */}
      <div ref={scrollRef} className="min-h-full w-max min-w-full py-8 pl-32 pr-8" onClick={() => store.getState().select(null)}>
        <div className="mx-auto" style={{ width: widthPx * zoom, minHeight: '100%' }}>
          {isEmpty && (
            <div className="mb-4 rounded-lg border border-dashed border-blue-300 bg-white/90 p-4 text-center" onClick={e => e.stopPropagation()}>
              <p className="font-semibold text-gray-800">{t('empty.title')}</p>
              <p className="mt-1 text-sm text-gray-500">{t('empty.text')}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => store.getState().setTemplate(invoicePreset(presetBandNames(t)), t('files.presetName'))}>{t('empty.preset')}</Button>
            </div>
          )}
          <div className="relative shadow-lg bg-white" style={{ width: widthPx, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {template.bands.map((band, i) => <BandView key={band.id} band={band} widthPx={widthPx} growth={growth[i]} />)}
            {drop && dropBandIndex >= 0 && (
              <>
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-300/30 pointer-events-none z-40"
                  style={{ left: mmToPx(drop.x), top: mmToPx(bandTops[dropBandIndex] + drop.y + shownOffset(dropBandIndex, drop.y)), width: mmToPx(drop.width), height: Math.max(2, mmToPx(drop.height)) }}
                >
                  <span className="absolute -top-5 left-0 whitespace-nowrap bg-blue-600 text-white text-[10px] font-mono px-1 rounded">
                    {drop.x.toFixed(1)}, {drop.y.toFixed(1)} mm
                  </span>
                </div>
                {drop.guides.map((g, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none z-50 border-red-500 border-dashed"
                    style={g.axis === 'x'
                      ? { left: mmToPx(g.at), top: 0, bottom: 0, borderLeftWidth: 1 }
                      : { top: mmToPx(bandTops[dropBandIndex] + g.at + shownOffset(dropBandIndex, g.at)), left: 0, right: 0, borderTopWidth: 1 }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="sticky bottom-3 float-right mr-3 -mt-12 flex items-center gap-0.5 bg-white border rounded-md shadow px-1 py-0.5 z-40" role="group" aria-label={t('settings.zoom')}>
        <button type="button" className="p-1 rounded hover:bg-gray-100" aria-label={t('zoom.out')} title={t('zoom.out')} onClick={() => store.getState().setZoom(Math.round((zoom - 0.25) * 4) / 4)}><Minus size={14} /></button>
        <span className="text-xs w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" className="p-1 rounded hover:bg-gray-100" aria-label={t('zoom.in')} title={t('zoom.in')} onClick={() => store.getState().setZoom(Math.round((zoom + 0.25) * 4) / 4)}><Plus size={14} /></button>
        <button type="button" className="p-1 rounded hover:bg-gray-100" aria-label={t('zoom.fit')} title={t('zoom.fit')}
          onClick={() => { const area = scrollRef.current?.parentElement; if (area) store.getState().setZoom(fitZoom(area.clientWidth, widthPx)); }}><Maximize size={14} /></button>
      </div>
      <DragOverlay dropAnimation={null}>
        {drag?.type === 'tool' ? <div className="px-3 py-2 bg-white border rounded shadow text-sm capitalize opacity-90">{drag.tool}</div> : null}
      </DragOverlay>
    </>
  );
}
