import { useState } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { useStore } from './store/useStore';
import { type SectionName, type CanvasElement } from './types';
import { MM_TO_PX } from './lib/constants';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const SNAP_SIZE = 10;
const snap = (val: number) => Math.round(val / SNAP_SIZE) * SNAP_SIZE;

function App() {
    const { addElement, updateElement, removeElement, selectElement, canvasWidth, zoomLevel } = useStore();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dragData, setDragData] = useState<any>(null);
    const [showCenterGuide, setShowCenterGuide] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor)
    );

    // Canvas width in px
    const CANVAS_WIDTH_PX = canvasWidth * MM_TO_PX;
    const CENTER_X = CANVAS_WIDTH_PX / 2;
    const SNAP_THRESHOLD = 5;

    const snapToCenterModifier = ({ transform, draggingNodeRect }: any) => {
        if (!draggingNodeRect || !activeId || !dragData || dragData.type !== 'element') return transform;

        // When zoomed, the transform (screen delta) maps to different internal unit change
        // logic: screen_delta = internal_delta * zoom
        // internal_delta = screen_delta / zoom
        // But the modifier receives 'transform' which is the screen delta from dnd-kit.
        // We need to decide if we modify the *visual* transform (screen pixels) or logical.
        // dnd-kit expects screen pixels for the transform. 
        // Our snap logic checks internal coordinates.

        const element = dragData.element;
        // Convert screen delta to internal delta
        const internalDeltaX = transform.x / zoomLevel;

        const currentX = element.x + internalDeltaX;
        const centerX = currentX + (element.width / 2);

        const dist = Math.abs(centerX - CENTER_X);

        if (dist < SNAP_THRESHOLD) {
            // Snap!
            const newInternalX = CENTER_X - (element.width / 2);
            const neededInternalDeltaX = newInternalX - element.x;

            // Convert back to screen delta for the transform
            const neededScreenDeltaX = neededInternalDeltaX * zoomLevel;

            return {
                ...transform,
                x: neededScreenDeltaX,
            };
        }

        return transform;
    };


    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setDragData(event.active.data.current);
        setShowCenterGuide(false);
    };

    const handleDragMove = (event: any) => {
        const { active, delta } = event;
        const activeData = active.data.current;
        if (!activeData || activeData.type !== 'element') {
            setShowCenterGuide(false);
            return;
        }

        // Calculate projected position to show guide
        const element = activeData.element;
        const internalDeltaX = delta.x / zoomLevel;

        const currentX = element.x + internalDeltaX;
        const centerX = currentX + (element.width / 2);
        const dist = Math.abs(centerX - CENTER_X);

        if (dist < SNAP_THRESHOLD) {
            setShowCenterGuide(true);
        } else {
            setShowCenterGuide(false);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over, delta } = event;

        setActiveId(null);
        setDragData(null);
        setShowCenterGuide(false);

        if (!over) return;

        const activeData = active.data.current;
        const overData = over.data.current;

        if (!activeData || !overData) return;

        // 1. Dragging Tool to Section (Create New)
        if (activeData.type === 'tool' && overData.type === 'section') {
            const sectionName = overData.name as SectionName;
            const overRect = over.rect; // This rect is in screen coordinates, effectively zoomed

            // We need relative position within the container. 
            // The container is scaled. 
            // event.active.rect.current.translated might be useful?
            // Simpler: use the delta approach if we had a start point, but here we drop.

            // Mouse event client coordinates
            // dnd-kit doesn't give mouse event easily in DragEndEvent except via activatorEvent
            // but `delta` is reliable.
            // Problem: We don't know the exact "internal" drop coordinate easily from just `delta` if we don't know start.

            // Actually, `over.rect` gives the screen bounding box of the droppable section.
            // `event.active.rect.current.translated` gives screen bounding box of dragged item.
            // `dropX relative to section` = (draggedItem.left - section.left) / zoomLevel.

            // Let's use the rectangles provided by dnd-kit
            const activeRect = event.active.rect.current.translated;
            if (!activeRect) return; // Should allow null check

            const relativeX = (activeRect.left - overRect.left) / zoomLevel;
            const relativeY = (activeRect.top - overRect.top) / zoomLevel;

            // Should we snap create too? Maybe later. For now keep existing snap.
            const x = snap(Math.max(0, relativeX));
            const y = snap(Math.max(0, relativeY));

            const newElement: CanvasElement = {
                id: generateId(),
                type: activeData.toolType,
                x,
                y,
                isDynamic: activeData.toolType === 'image' && activeData.imageKey === 'GibQRCode',
                content: activeData.toolType === 'text' ? 'New Text' : activeData.toolType === 'barcode' ? '12345678' : undefined,
                imageKey: activeData.imageKey,
                width: activeData.toolType === 'box' ? 100 : activeData.toolType === 'barcode' ? 150 : activeData.toolType === 'image' ? 60 : 100,
                height: activeData.toolType === 'box' ? 50 : activeData.toolType === 'barcode' ? 60 : activeData.toolType === 'image' ? 60 : 50,
                fontSize: 12,
                barcodeType: activeData.toolType === 'barcode' ? 'code128' : undefined,
                showLabel: activeData.toolType === 'barcode' ? true : undefined,
            };

            console.log(`Adding new ${newElement.type} to ${sectionName} at ${x},${y}`);
            addElement(sectionName, newElement);
            selectElement(newElement.id, sectionName);
        }

        // 2. Dragging Existing Element
        else if (activeData.type === 'element') {
            const element = activeData.element as CanvasElement;
            const currentSection = activeData.section as SectionName;
            const targetSection = overData.name as SectionName;

            // Calculate final snapped position
            // delta is screen pixels. 
            // internalDelta = delta / zoomLevel

            const internalDeltaX = delta.x / zoomLevel;
            const internalDeltaY = delta.y / zoomLevel;

            let newX = element.x + internalDeltaX;
            const elementWidth = element.width || 0;
            const centerX = newX + (elementWidth / 2);

            if (Math.abs(centerX - CENTER_X) < SNAP_THRESHOLD) {
                newX = CENTER_X - (elementWidth / 2);
            } else {
                newX = snap(Math.max(0, newX));
            }

            const newY = snap(Math.max(0, element.y + internalDeltaY));

            // If moving within same section
            if (currentSection === targetSection) {
                updateElement(currentSection, element.id, { x: newX, y: newY });
            }
            // If moving to different section
            else if (overData.type === 'section') {
                removeElement(currentSection, element.id);

                const newElement = {
                    ...element,
                    x: newX, // Use calculated X
                    y: 10
                };
                addElement(targetSection, newElement);
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            modifiers={[snapToCenterModifier]}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            <Layout
                sidebar={<Sidebar />}
                propertiesPanel={<PropertiesPanel />}
            >
                <div className="flex flex-col items-center py-8 min-h-full relative bg-gray-100 overflow-auto">
                    {showCenterGuide && (
                        <div
                            className="absolute top-0 bottom-0 border-l border-red-500 border-dashed z-50 pointer-events-none"
                            style={{ left: '50%' }}
                        />
                    )}

                    {/*
                        Zoom Implementation:
                        We need a container that physically grows to force scrollbars.
                        Inside it, we place the scaled element.
                        The outer container centers the inner content.
                     */}
                    <div style={{
                        width: CANVAS_WIDTH_PX * zoomLevel,
                        // Height is tricky because it's dynamic based on content.
                        // But we can let the inner div determine height and scale it?
                        // Actually better: just scale the inner div and use 'zoom' property? No, zoom is non-standard.
                        // Best way: Wrap in a div that has the scaled size, and inside use transform scale.
                        // But since height is unknown, we can just use a large padding or rely on the transform expanding visual flow?
                        // No, transform doesn't expand flow.

                        // Alternative: "zoom" style actually works well in Chrome/Safari for layout.
                        // Let's try standard transform with a wrapper that has enough size?
                        // Or just let it overflow?

                        // Let's try a simple approach:
                        // Transform origin top center.
                        // Margin bottom to compensate for growth which pushes down? No, transform doesn't push neighbours.

                        // User wants "gray area" to be filled.
                        // If we scale up, we want the gray background (parent) to show scrollbars.
                        // The parent is flex-col items-center.

                        // Let's use a wrapper that has the scaled width/height.
                        // We need to know the height. We can get it from ref?
                        // Or we can use `zoom` CSS property which IS supported in Chrome/Edge/Safari (Webkit) and handles layout.
                        // Firefox doesn't support it well, but for an internal tool or specific browser...
                        // Let's stick to transform.

                        // To make scrollbars work with transform:
                        // We need a wrapper with dimensions: width * zoom, height * zoom.
                        // But we don't know height.

                        // Hack: use a very large min-height?
                        minHeight: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        paddingBottom: '50vh', // Extra space at bottom
                    }}>
                        <div style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top center',
                            // When scaling up, the element grows outwards from center.
                            // The parent flex centers it.
                            // If it grows wider than viewport, flex start aligns it? No, items-center keeps it centered but might clip left.
                            // We need to handle that.
                        }}>
                            <Canvas />
                        </div>
                    </div>
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
