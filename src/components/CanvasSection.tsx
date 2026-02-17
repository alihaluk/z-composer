import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { type SectionName, type SectionState } from '../types';
import { DraggableElement } from './DraggableElement';
import { cn } from '../lib/utils';
import { MM_TO_PX } from '../lib/constants';

interface CanvasSectionProps {
  name: SectionName;
  state: SectionState;
  className?: string;
  width: number; // in pixels
}

export const CanvasSection = ({ name, state, className, width }: CanvasSectionProps) => {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: name,
    data: {
      type: 'section',
      name,
    },
  });

  const heightPx = state.height * MM_TO_PX;

  return (
    <div
      ref={setNodeRef}
      style={{ height: heightPx, width }}
      className={cn("relative bg-white border-b border-dashed border-gray-300 overflow-hidden transition-all shrink-0", className)}
    >
       {/* Grid lines */}
       <div className="absolute inset-0 pointer-events-none opacity-10"
            style={{
                backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                backgroundSize: '10px 10px'
            }}
       />

       <div className="absolute top-0 left-0 bg-gray-100/80 text-[10px] text-gray-500 px-1 uppercase tracking-wider z-10 select-none border-br rounded-br">
         {t(`sections.${name}`)} ({state.height}mm)
       </div>

      {state.elements.map((el) => (
        <DraggableElement key={el.id} element={el} section={name} />
      ))}
    </div>
  );
};
