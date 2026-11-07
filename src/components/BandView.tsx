import { useRef, useState, type PointerEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Filter, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { mmToPx, pxToMm } from '../lib/constants';
import { useEditor, useEditorStore } from '../store/editorStore';
import { type BandGrowth } from '../lib/elementDisplay';
import { type Band } from '../types';
import { CanvasElement } from './CanvasElement';
import { bindingPath, type FieldRef } from '../lib/fieldElements';

export function BandView({ band, widthPx, growth }: { band: Band; widthPx: number; growth: BandGrowth }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const bandSelected = useEditor(s => s.selection?.bandId === band.id && s.selection.ids.length === 0);
  const { setNodeRef, isOver, active } = useDroppable({ id: band.id, data: { type: 'band', bandId: band.id } });
  // A dragged field lights up only the bands that can print it.
  const activeData = active?.data.current as { type?: string; field?: FieldRef } | undefined;
  const accepts = activeData?.type !== 'field' || !activeData.field || bindingPath(activeData.field, band) !== null;
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragged = useRef(false);

  // Dragging on an empty spot of the band selects the elements the rectangle touches.
  const startMarquee = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[role=button]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / widthPx;
    const toMm = (clientX: number, clientY: number) => ({ x: pxToMm((clientX - rect.left) / scale), y: pxToMm((clientY - rect.top) / scale) });
    const start = toMm(e.clientX, e.clientY);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    dragged.current = false;
    let box = { x: start.x, y: start.y, w: 0, h: 0 };
    const move = (ev: globalThis.PointerEvent) => {
      const p = toMm(ev.clientX, ev.clientY);
      box = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      if (box.w + box.h > 1) { dragged.current = true; setMarquee(box); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      if (!dragged.current) return;
      const shownY = (y: number) => y + (growth.extraMm > 0 && y > growth.growY ? growth.extraMm : 0);
      const hit = band.elements.filter(el => {
        const y = shownY(el.y);
        return el.x < box.x + box.w && el.x + el.width > box.x && y < box.y + box.h && y + el.height > box.y;
      }).map(el => el.id);
      const { selection, select } = store.getState();
      const previous = additive ? selection?.ids ?? [] : [];
      select({ bandId: band.id, ids: [...new Set([...previous, ...hit])] });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="relative" style={{ width: widthPx }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); store.getState().select({ bandId: band.id, ids: [] }); }}
        className={cn(
          'absolute right-full top-0 mr-1 max-w-[120px] text-[10px] leading-tight px-1.5 py-0.5 rounded-l border text-left whitespace-nowrap overflow-hidden text-ellipsis',
          bandSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400',
        )}
        title={[
          band.name,
          band.repeat && `${t('bands.repeat')}: ${band.repeat}`,
          band.condition?.path && `${t('condition.title')}: ${band.condition.path} · ${t(`condition.${band.condition.op}`)}`,
        ].filter(Boolean).join('\n')}
      >
        {band.repeat && <Repeat size={9} aria-hidden className="inline mr-0.5 -mt-0.5" />}
        {band.condition?.path && <Filter size={9} aria-hidden className="inline mr-0.5 -mt-0.5" />}
        {band.name}
        <span className={bandSelected ? 'text-blue-100' : 'text-gray-500'}> · {band.height}mm</span>
      </button>
      <div
        ref={setNodeRef}
        onPointerDown={startMarquee}
        onClick={e => {
          e.stopPropagation();
          // A finished rectangle selection already set the selection.
          if (dragged.current) { dragged.current = false; return; }
          store.getState().select({ bandId: band.id, ids: [] });
        }}
        style={{ height: mmToPx(band.height + growth.extraMm), width: widthPx }}
        className={cn(
          // Overflow stays visible: content past the band edge also prints over the next band.
          'relative border-b border-dashed border-gray-300',
          band.repeat ? 'bg-amber-50/40' : 'bg-white',
          bandSelected && 'ring-2 ring-inset ring-blue-400',
          isOver && accepts && 'bg-blue-50/60',
        )}
        role="group"
        aria-label={t('bands.region', { name: band.name })}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: `${mmToPx(1)}px ${mmToPx(1)}px` }}
        />
        {band.elements.map(el => (
          <CanvasElement key={el.id} element={el} band={band}
            offsetY={growth.extraMm > 0 && el.y > growth.growY ? growth.extraMm : 0}
            lines={el.id === growth.elementId ? growth.lines : undefined} />
        ))}
        {marquee && (
          <div className="absolute border border-blue-500 bg-blue-400/10 pointer-events-none z-30"
            style={{ left: mmToPx(marquee.x), top: mmToPx(marquee.y), width: mmToPx(marquee.w), height: mmToPx(marquee.h) }} />
        )}
      </div>
    </div>
  );
}
