import { useState } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, pointerWithin } from '@dnd-kit/core';
import { useStore } from './store/useStore';
import { type SectionName, type CanvasElement } from './types';
import { MM_TO_PX } from './lib/constants';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const SNAP_SIZE = 10;
const snap = (val: number) => Math.round(val / SNAP_SIZE) * SNAP_SIZE;

const GUIDE_OFFSET_LEFT = 0;

function App() {
    const { addElement, updateElement, removeElement, selectElement, canvasWidth, zoomLevel, header, body, footer } = useStore();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dragData, setDragData] = useState<any>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor)
    );

    // Canvas width in px
    const CANVAS_WIDTH_PX = canvasWidth * MM_TO_PX;
    const CENTER_X = CANVAS_WIDTH_PX / 2;
    const SNAP_THRESHOLD = 5;




    const [alignmentGuides, setAlignmentGuides] = useState<Array<{ type: 'vertical' | 'horizontal', position: number }>>([]);

    // Memoize snap points when drag starts to avoid recalculation
    const [snapPoints, setSnapPoints] = useState<{ x: number[], y: number[], centerX: number[], centerY: number[] }>({ x: [], y: [], centerX: [], centerY: [] });

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setDragData(event.active.data.current);
        setAlignmentGuides([]);

        const draggingId = event.active.id;

        // Calculate absolute offsets for sections in px
        const getSectionOffset = (sectionName: SectionName) => {
            if (sectionName === 'header') return 0;
            if (sectionName === 'body') return header.height * MM_TO_PX;
            if (sectionName === 'footer') return (header.height + body.height) * MM_TO_PX;
            return 0;
        };

        const allElements = [
            ...header.elements.map(el => ({ ...el, absoluteY: el.y + getSectionOffset('header') })),
            ...body.elements.map(el => ({ ...el, absoluteY: el.y + getSectionOffset('body') })),
            ...footer.elements.map(el => ({ ...el, absoluteY: el.y + getSectionOffset('footer') }))
        ].filter(el => el.id !== draggingId);

        const xPoints: number[] = [];
        const centerPoints: number[] = [CENTER_X];

        const yPoints: number[] = [];
        const centerYPoints: number[] = [];

        allElements.forEach(el => {
            if (el.x !== undefined) xPoints.push(el.x);
            if (el.width && el.x !== undefined) {
                xPoints.push(el.x + el.width);
                centerPoints.push(el.x + el.width / 2);
            }

            if (el.absoluteY !== undefined) yPoints.push(el.absoluteY);
            if (el.height && el.absoluteY !== undefined) {
                yPoints.push(el.absoluteY + el.height);
                centerYPoints.push(el.absoluteY + el.height / 2);
            }
        });

        setSnapPoints({ x: xPoints, centerX: centerPoints, y: yPoints, centerY: centerYPoints });
    };

    // Interactive snap logic in handleDragMove is easier for "guides" but "modifier" is needed for actual position.
    // Let's implement a custom modifier that we pass to DndContext.


    const handleDragMove = (event: any) => {
        const { active, delta } = event;
        // Logic to update Visual Guides based on same math

        const activeData = active.data.current;
        if (!activeData || activeData.type !== 'element') {
            setAlignmentGuides([]);
            return;
        }

        const element = activeData.element;
        const currentLeft = element.x + (delta.x / zoomLevel);
        const currentWidth = element.width || 0;
        const currentRight = currentLeft + currentWidth;
        const currentCenter = currentLeft + currentWidth / 2;

        const newGuides: typeof alignmentGuides = [];

        // Re-run similar proximity check just for visualization
        for (const pt of snapPoints.centerX) {
            if (Math.abs(currentCenter - pt) < SNAP_THRESHOLD) {
                newGuides.push({ type: 'vertical', position: pt });
            }
        }
        if (newGuides.length === 0) {
            for (const pt of snapPoints.x) {
                if (Math.abs(currentLeft - pt) < SNAP_THRESHOLD) {
                    newGuides.push({ type: 'vertical', position: pt });
                } else if (Math.abs(currentRight - pt) < SNAP_THRESHOLD) {
                    newGuides.push({ type: 'vertical', position: pt });
                }
            }
        }

        // Optimization: Only update if changed
        if (JSON.stringify(newGuides) !== JSON.stringify(alignmentGuides)) {
            setAlignmentGuides(newGuides);
        }
    };


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over, delta } = event;

        setActiveId(null);
        setDragData(null);
        setAlignmentGuides([]);

        if (!over) return;

        // ... rest of logic uses new snapModifier's effective result?
        // Dnd-kit DragEndEvent.delta includes the modifier's changes!
        // So we just rely on `delta`.

        const activeData = active.data.current;
        const overData = over.data.current;

        if (!activeData || !overData) return;

        // ... existing handleDragEnd logic ...


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
                // Default props first
                isDynamic: false,
                content: activeData.toolType === 'text' ? 'New Text' : activeData.toolType === 'barcode' ? '12345678' : undefined,
                width: activeData.toolType === 'box' ? 100 : activeData.toolType === 'barcode' ? 150 : activeData.toolType === 'image' ? 60 : 100,
                height: activeData.toolType === 'box' ? 50 : activeData.toolType === 'barcode' ? 60 : activeData.toolType === 'image' ? 60 : 50,
                fontSize: 12,
                barcodeType: activeData.toolType === 'barcode' ? 'code128' : undefined,
                showLabel: activeData.toolType === 'barcode' ? true : undefined,

                // Spread activeData to override defaults (e.g. for Gib QR Code)
                ...activeData,

                // Critical fields - these MUST come last to ensure they are not overwritten
                id: generateId(),
                type: activeData.toolType,
                x,
                y
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

            console.log('Math Trace:', {
                elementX: element.x,
                deltaX: delta.x,
                zoomLevel,
                internalDeltaX,
                startNewX: element.x + internalDeltaX
            });

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
            modifiers={[]}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            <Layout
                sidebar={<Sidebar />}
                propertiesPanel={<PropertiesPanel />}
            >
                <div className="flex flex-col items-center py-8 min-h-full relative bg-gray-100 overflow-auto">
                    {alignmentGuides.map((guide, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 border-l border-red-500 border-dashed z-50 pointer-events-none"
                            style={{
                                left: GUIDE_OFFSET_LEFT + (guide.position * zoomLevel),
                                // We need to calculate absolute left based on the Canvas position in the container.
                                // The Canvas is centered.
                                // It works via flex items-center.
                                // Actually, simpler: Put these guides INSIDE the scaled container!
                                // Then just `left: guide.position`.
                            }}
                        />
                    ))}

                    {/*
                        Zoom Implementation:
                     */}

                    <div style={{
                        width: CANVAS_WIDTH_PX * zoomLevel,
                        minHeight: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        paddingBottom: '50vh',
                        position: 'relative',
                    }}>
                        <div style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top center',
                            position: 'relative'
                        }}>
                            {/* Guides Rendered INSIDE the scale context */}
                            {alignmentGuides.map((guide, i) => (
                                <div
                                    key={i}
                                    className={`absolute pointer-events-none z-50 ${guide.type === 'vertical'
                                        ? 'border-l border-red-500 border-dashed -top-[2000px] -bottom-[2000px]'
                                        : 'border-t border-red-500 border-dashed -left-[2000px] -right-[2000px]'
                                        }`}
                                    style={guide.type === 'vertical' ? {
                                        left: guide.position, // Absolute Internal X
                                        borderLeftWidth: '1px' // Force 1px visible line
                                    } : {
                                        top: guide.position, // Absolute Internal Y
                                        borderTopWidth: '1px' // Force 1px visible line
                                    }}
                                />
                            ))}
                            <Canvas />
                        </div>
                    </div>
                </div>
            </Layout>

            <DragOverlay dropAnimation={null} className="pointer-events-none">
                {activeId && dragData ? (
                    dragData.type === 'tool' ? (
                        // Tool Drag: No scaling, keep it UI-sized
                        <div className="flex items-center gap-2 p-3 bg-white border rounded shadow opacity-90 cursor-grabbing w-32">
                            <span className="capitalize">{dragData.toolType}</span>
                        </div>
                    ) : (
                        // Element Drag: 
                        // dnd-kit positions the overlay matching the activator's client rect.
                        // Since the activator (canvas element) is ALREADY scaled on screen, dnd-kit captures that scaled size.
                        // If we apply scale() AGAIN here, we get double scaling (e.g. 2x * 2x = 4x).
                        // So we should NOT scale here if we want 1:1 match with what the user sees on canvas.
                        // We strictly set width/height to match the element's internal size, but dnd-kit might stretch it?
                        // Actually, if we just render the content at 100% scale (internal), and let dnd-kit's size matching work?
                        // Providing explicit width/height (unscaled) + Scale transform?
                        // Providing explicit width/height (SCALED) + No transform?

                        // Best approach: Render unscaled content, but apply scale transform to match canvas zoom.
                        // BUT wait, if dnd-kit sees 200px activator, it might size the overlay wrapper to 200px.
                        // If we put a 100px div inside and scale(2), it fills the 200px wrapper. 
                        // This seems correct logic, BUT user says "too zoomed".

                        // Let's try REMOVING scale and just sizing it to matches element dimensions * zoomLevel explicitly?
                        // Or just standard rendering?

                        // Hypothesis: The user sees "too zoomed" because the overlay is huge.
                        // If I remove scale, it might be small (100px) on a 200px hole.

                        // Let's try to match the Canvas logic exactly.
                        // Canvas: <div style={{ transform: scale(zoom) }}> <Element /> </div>
                        // Overlay: <div style={{ transform: scale(zoom) }}> <Element /> </div>
                        // this SHOULD be right.

                        // Maybe the `transformOrigin` is wrong?
                        // If dnd-kit aligns top-left of overlay with top-left of element.
                        // And we scale from top-left. It should match.

                        // WHAT IF: dnd-kit modifier or something is interfering?
                        // Or `dragData` is stale?

                        // Let's try a different strategy:
                        // No scale transform.
                        // Just set width/height to `element.width * zoomLevel` and `element.height * zoomLevel`.
                        // Render content using that size.
                        // This eliminates CSS transform ambiguity.

                        <div style={{
                            width: (dragData.element?.width || 0) * zoomLevel,
                            height: (dragData.element?.height || 0) * zoomLevel,
                        }}>
                            <div className="border border-blue-500 bg-white/80 p-1 whitespace-nowrap shadow-xl cursor-grabbing w-full h-full flex items-center justify-center overflow-hidden text-sm">
                                {dragData.element?.type === 'box' ? (
                                    <div className="w-full h-full border-2 border-black bg-black/5" />
                                ) : dragData.element?.type === 'image' ? (
                                    <span className="text-[10px] text-gray-500 font-bold">IMAGE</span>
                                ) : (
                                    <span style={{ fontSize: `${(dragData.element?.fontSize || 12) * zoomLevel}px` }}>
                                        {dragData.element?.content || dragData.element?.dataSource || 'Element'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default App;
