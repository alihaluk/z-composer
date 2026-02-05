import { useState } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { useStore } from './store/useStore';
import { type SectionName, type CanvasElement } from './types';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const SNAP_SIZE = 10;
const snap = (val: number) => Math.round(val / SNAP_SIZE) * SNAP_SIZE;

function App() {
  const { addElement, updateElement, removeElement } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragData, setDragData] = useState<any>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      setDragData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;

    setActiveId(null);
    setDragData(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) return;

    // 1. Dragging Tool to Section (Create New)
    if (activeData.type === 'tool' && overData.type === 'section') {
        const sectionName = overData.name as SectionName;

        const newElement: CanvasElement = {
            id: generateId(),
            type: activeData.toolType,
            x: 10,
            y: 10,
            isDynamic: false,
            content: activeData.toolType === 'text' ? 'New Text' : undefined,
            width: activeData.toolType === 'box' ? 100 : undefined,
            height: activeData.toolType === 'box' ? 50 : undefined,
            fontSize: 12
        };

        addElement(sectionName, newElement);
    }

    // 2. Dragging Existing Element
    else if (activeData.type === 'element') {
        const element = activeData.element as CanvasElement;
        const currentSection = activeData.section as SectionName;
        const targetSection = overData.name as SectionName;

        // If moving within same section
        if (currentSection === targetSection) {
             const newX = snap(Math.max(0, element.x + delta.x));
             const newY = snap(Math.max(0, element.y + delta.y));
             updateElement(currentSection, element.id, { x: newX, y: newY });
        }
        // If moving to different section
        else if (overData.type === 'section') {
            removeElement(currentSection, element.id);

            // Try to keep X, reset Y to something visible
            const newElement = {
                ...element,
                x: snap(Math.max(0, element.x + delta.x)),
                y: 10
            };
            addElement(targetSection, newElement);
        }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Layout
        sidebar={<Sidebar />}
        propertiesPanel={<PropertiesPanel />}
        >
            <div className="flex flex-col items-center py-8 min-h-full">
                <Canvas />
            </div>
        </Layout>

        <DragOverlay>
             {activeId && dragData ? (
                 dragData.type === 'tool' ? (
                     <div className="flex items-center gap-2 p-3 bg-white border rounded shadow opacity-90 cursor-grabbing w-32">
                         <span className="capitalize">{dragData.toolType}</span>
                     </div>
                 ) : (
                     <div className="border border-blue-500 bg-white p-1 whitespace-nowrap shadow-xl opacity-90 cursor-grabbing">
                         {dragData.element?.content || dragData.element?.dataSource || 'Element'}
                     </div>
                 )
             ) : null}
        </DragOverlay>
    </DndContext>
  );
}

export default App;
