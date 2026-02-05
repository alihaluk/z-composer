import { useDraggable } from '@dnd-kit/core';
import { Type, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import { PreviewModal } from './PreviewModal';

interface SidebarItemProps {
    type: string;
    label: string;
    icon: any;
}

export const SidebarItem = ({ type, label, icon: Icon }: SidebarItemProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tool-${type}`,
    data: {
      type: 'tool',
      toolType: type,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 p-3 mb-2 bg-white border rounded shadow-sm cursor-move hover:bg-gray-50 transition-colors",
        isDragging && "opacity-50 ring-2 ring-blue-500"
      )}
    >
      <Icon size={16} />
      <span>{label}</span>
    </div>
  );
};

export const Sidebar = () => {
  return (
    <div className="p-4 flex flex-col h-full">
      <h2 className="text-lg font-bold mb-4 text-gray-800">Toolbox</h2>
      <SidebarItem type="text" label="Text Field" icon={Type} />
      <SidebarItem type="box" label="Box / Line" icon={Square} />

      <div className="mt-8 text-xs text-gray-500 flex-1">
          <p>Drag items to the canvas.</p>
      </div>

      <div className="pt-4 border-t mt-auto">
          <PreviewModal />
      </div>
    </div>
  );
};
