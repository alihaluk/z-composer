import { useDraggable } from '@dnd-kit/core';
import { type CanvasElement, type SectionName } from '../types';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';

interface DraggableElementProps {
  element: CanvasElement;
  section: SectionName;
}

export const DraggableElement = ({ element, section }: DraggableElementProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: element.id,
    data: {
      type: 'element',
      element,
      section,
    },
  });

  const selectElement = useStore((state) => state.selectElement);
  const selectedElementId = useStore((state) => state.selectedElementId);
  const isSelected = selectedElementId === element.id;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        fontSize: element.fontSize,
        fontWeight: element.fontBold ? 'bold' : 'normal',
      }}
      className={cn(
        "cursor-move border border-transparent hover:border-blue-300 select-none",
        isSelected && "border-blue-500 bg-blue-50/50",
        isDragging && "opacity-50",
        "whitespace-nowrap"
      )}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id, section);
      }}
      {...listeners}
      {...attributes}
    >
      {element.content || `{${element.dataSource}}` || 'Empty'}
    </div>
  );
};
