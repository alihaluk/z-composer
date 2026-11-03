import { useDroppable } from '@dnd-kit/core';
import { Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { mmToPx } from '../lib/constants';
import { useEditor, useEditorStore } from '../store/editorStore';
import { type Band } from '../types';
import { CanvasElement } from './CanvasElement';

export function BandView({ band, widthPx }: { band: Band; widthPx: number }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const bandSelected = useEditor(s => s.selection?.bandId === band.id && s.selection.ids.length === 0);
  const { setNodeRef, isOver } = useDroppable({ id: band.id, data: { type: 'band', bandId: band.id } });

  return (
    <div className="relative" style={{ width: widthPx }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); store.getState().select({ bandId: band.id, ids: [] }); }}
        className={cn(
          'absolute right-full top-0 mr-1 max-w-[120px] text-[10px] leading-tight px-1.5 py-0.5 rounded-l border text-left whitespace-nowrap overflow-hidden text-ellipsis',
          bandSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400',
        )}
        title={band.name}
      >
        {band.repeat && <Repeat size={9} className="inline mr-0.5 -mt-0.5" />}
        {band.condition?.path && <span className="mr-0.5">if</span>}
        {band.name}
        <span className="opacity-60"> · {band.height}mm</span>
      </button>
      <div
        ref={setNodeRef}
        onClick={e => { e.stopPropagation(); store.getState().select({ bandId: band.id, ids: [] }); }}
        style={{ height: mmToPx(band.height), width: widthPx }}
        className={cn(
          // Overflow stays visible: content past the band edge also prints over the next band.
          'relative border-b border-dashed border-gray-300',
          band.repeat ? 'bg-amber-50/40' : 'bg-white',
          bandSelected && 'ring-2 ring-inset ring-blue-400',
          isOver && 'bg-blue-50/60',
        )}
        aria-label={t('bands.region', { name: band.name })}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: `${mmToPx(1)}px ${mmToPx(1)}px` }}
        />
        {band.elements.map(el => <CanvasElement key={el.id} element={el} band={band} />)}
      </div>
    </div>
  );
}
