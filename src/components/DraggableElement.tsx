import { useDraggable } from '@dnd-kit/core';
import { type CanvasElement, type SectionName } from '../types';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';


interface DraggableElementProps {
  element: CanvasElement;
  section: SectionName;
}

export const DraggableElement = ({ element, section }: DraggableElementProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: element.id,
    data: {
      type: 'element',
      element,
      section,
    },
  });

  const selectElement = useStore((state) => state.selectElement);
  const selectedElementId = useStore((state) => state.selectedElementId);
  const zoomLevel = useStore((state) => state.zoomLevel);
  const isSelected = selectedElementId === element.id;

  // We do NOT apply transform here because we use DragOverlay.
  // Applying transform would move the original element (scaled weirdly inside the zoom container)
  // causing a double-vision effect where the original lags behind the overlay.
  // Instead, we let the original stay put (dimmed) and the overlay follows the cursor.
  const style = undefined;

  const getDisplayContent = () => {
    if (element.type === 'barcode') return null;
    if (element.type === 'image') return null;
    if (element.type === 'box') return null;

    if (element.isDynamic && element.dataSource) {
      // User requested to show Property Name instead of Mock Value to avoid confusion
      return `[${element.dataSource}]`;
    }

    return element.content || 'Empty';
  };

  const updateElement = useStore((state) => state.updateElement);

  // Resize Logic
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent drag
    // e.preventDefault(); // Optional, might block touch

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width || 0;
    const startHeight = element.height || 0;

    const onPointerMove = (moveEvent: PointerEvent) => {
      // Calculate delta in screen pixels
      const rawDeltaX = moveEvent.clientX - startX;
      const rawDeltaY = moveEvent.clientY - startY;

      // Adjust for zoom level to get internal units
      const deltaX = rawDeltaX / zoomLevel;
      const deltaY = rawDeltaY / zoomLevel;

      const newWidth = Math.max(10, startWidth + deltaX);
      const newHeight = Math.max(10, startHeight + deltaY);

      updateElement(section, element.id, { width: newWidth, height: newHeight });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };


  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height, // Ensure height is applied for all elements now
        fontSize: element.fontSize,
        fontWeight: element.fontBold ? 'bold' : 'normal',
      }}
      className={cn(
        "cursor-move border border-transparent hover:border-blue-300 select-none overflow-visible group", // overflow-visible for handle
        isSelected && "border-blue-500 bg-blue-50/50",
        isDragging && "opacity-20", // Make original very faint so overlay is primary focus
        element.type === 'text' && "whitespace-nowrap"
      )}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id, section);
      }}
      {...listeners}
      {...attributes}
    >
      {element.type === 'barcode' ? (
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100 border border-slate-300">
          <div className="w-full h-2/3 bg-[repeating-linear-gradient(90deg,black,black_2px,transparent_2px,transparent_4px)]" />
          <span className="text-[8px] font-mono mt-0.5 truncate w-full text-center">
            {getDisplayContent() || (element.isDynamic ? `{${element.dataSource}}` : element.content)}
          </span>
        </div>
      ) : element.type === 'image' ? (
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50 border border-slate-300 rounded overflow-hidden">
          <div className="flex items-center justify-center flex-1 bg-white w-full">
            <span className="text-[10px] text-gray-400 p-1 text-center font-bold">IMAGE</span>
          </div>
          <div className="bg-slate-700 text-white w-full py-0.5 px-1">
            <p className="text-[9px] truncate text-center">{element.imageKey || 'None'}</p>
          </div>
        </div>
      ) : element.type === 'box' ? (
        <div className="w-full h-full border-2 border-black bg-black/5" />
      ) : (
        getDisplayContent()
      )}

      {/* Resize Handle (Bottom Right) */}
      {isSelected && (
        <div
          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50 shadow-sm"
          onPointerDown={handleResizePointerDown}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};
