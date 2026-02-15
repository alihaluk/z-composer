import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, pointerWithin, type DragMoveEvent, type Modifier } from '@dnd-kit/core';
import { useStore } from './store/useStore';
import { type SectionName, type CanvasElement } from './types';
import { MM_TO_PX } from './lib/constants';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const SNAP_SIZE = 10;
const snap = (val: number) => Math.round(val / SNAP_SIZE) * SNAP_SIZE;


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

    // Memoize snap points when drag starts
    const [snapPoints, setSnapPoints] = useState<{ x: number[], y: number[], centerX: number[], centerY: number[] }>({ x: [], y: [], centerX: [], centerY: [] });

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input
            if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
                return;
            }

            const state = useStore.getState();
            const { selectedElementId, selectedSection, header, body, footer, updateElement } = state;

            if (!selectedElementId || !selectedSection) return;

            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

            e.preventDefault();

            let elements;
            if (selectedSection === 'header') elements = header.elements;
            else if (selectedSection === 'body') elements = body.elements;
            else if (selectedSection === 'footer') elements = footer.elements;

            const element = elements?.find(el => el.id === selectedElementId);
            if (!element) return;

            const step = e.shiftKey ? 10 : 1;
            let newX = element.x;
            let newY = element.y;

            switch (e.key) {
                case 'ArrowLeft': newX -= step; break;
                case 'ArrowRight': newX += step; break;
                case 'ArrowUp': newY -= step; break;
                case 'ArrowDown': newY += step; break;
            }

            updateElement(selectedSection, selectedElementId, { x: newX, y: newY });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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


    const handleDragMove = (event: DragMoveEvent) => {
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

        // Center Snapping Guide
        for (const pt of snapPoints.centerX) {
            if (Math.abs(currentCenter - pt) < SNAP_THRESHOLD) {
                newGuides.push({ type: 'vertical', position: pt });
            }
        }

        // Edge Snapping Guides
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

        const activeData = active.data.current;
        const overData = over.data.current;

        if (!activeData || !overData) return;

        // 1. Dragging Tool to Section (Create New)
        if (activeData.type === 'tool' && overData.type === 'section') {
            const sectionName = overData.name as SectionName;
            const overRect = over.rect;

            // Calculate dropped position relative to the scaled section
            const activeRect = event.active.rect.current.translated;
            if (!activeRect) return;

            const relativeX = (activeRect.left - overRect.left) / zoomLevel;
            const relativeY = (activeRect.top - overRect.top) / zoomLevel;

            const x = snap(Math.max(0, relativeX));
            const y = snap(Math.max(0, relativeY));

            const newElement: CanvasElement = {
                // Default props
                isDynamic: false,
                content: activeData.toolType === 'text' ? 'New Text' : activeData.toolType === 'barcode' ? '12345678' : undefined,
                width: activeData.toolType === 'box' ? 100 : activeData.toolType === 'barcode' ? 150 : activeData.toolType === 'image' ? 60 : 100,
                height: activeData.toolType === 'box' ? 50 : activeData.toolType === 'barcode' ? 60 : activeData.toolType === 'image' ? 60 : 50,
                fontSize: 12,
                barcodeType: activeData.toolType === 'barcode' ? 'code128' : undefined,
                showLabel: activeData.toolType === 'barcode' ? true : undefined,

                ...activeData,

                id: generateId(),
                type: activeData.toolType,
                x,
                y
            };

            addElement(sectionName, newElement);
            selectElement(newElement.id, sectionName);
        }

        // 2. Dragging Existing Element
        else if (activeData.type === 'element') {
            const element = activeData.element as CanvasElement;
            const currentSection = activeData.section as SectionName;
            const targetSection = overData.name as SectionName;

            // Calculate final snapped position
            const internalDeltaX = delta.x / zoomLevel;
            const internalDeltaY = delta.y / zoomLevel;

            let newX = element.x + internalDeltaX;
            const elementWidth = element.width || 0;
            const centerX = newX + (elementWidth / 2);

            // Apply Center Snapping
            if (Math.abs(centerX - CENTER_X) < SNAP_THRESHOLD) {
                newX = CENTER_X - (elementWidth / 2);
            } else {
                newX = snap(Math.max(0, newX));
            }

            const newY = snap(Math.max(0, element.y + internalDeltaY));

            if (currentSection === targetSection) {
                updateElement(currentSection, element.id, { x: newX, y: newY });
            }
            else if (overData.type === 'section') {
                removeElement(currentSection, element.id);
                const newElement = {
                    ...element,
                    x: newX,
                    y: Math.max(0, newY) // Ensure positive Y in new section
                };
                addElement(targetSection, newElement);
            }
        }
    };

    // Custom Modifier to constrain movement or snap live?
    // For now, we rely on Visual Guides + End Snap.
    const modifiers: Modifier[] = [];

    return (
        <DndContext
            sensors={sensors}
            modifiers={modifiers}
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
                    {/* Zoom Container */}
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
                            {/* Alignment Guides */}
                            {alignmentGuides.map((guide, i) => (
                                <div
                                    key={i}
                                    className={`absolute pointer-events-none z-50 ${guide.type === 'vertical'
                                        ? 'border-l border-red-500 border-dashed -top-[2000px] -bottom-[2000px]'
                                        : 'border-t border-red-500 border-dashed -left-[2000px] -right-[2000px]'
                                        }`}
                                    style={guide.type === 'vertical' ? {
                                        left: guide.position, // Absolute Internal X
                                        borderLeftWidth: '1px'
                                    } : {
                                        top: guide.position, // Absolute Internal Y
                                        borderTopWidth: '1px'
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
                        <div className="flex items-center gap-2 p-3 bg-white border rounded shadow opacity-90 cursor-grabbing w-32">
                            <span className="capitalize">{dragData.toolType}</span>
                        </div>
                    ) : (
                        // Render Element Overlay
                        // We scale the content manually to match the visual size on canvas
                        <div style={{
                            width: dragData.element?.width ? dragData.element.width * zoomLevel : 'max-content',
                            height: dragData.element?.height ? dragData.element.height * zoomLevel : 'max-content',
                            minWidth: '20px',
                            minHeight: '20px',
                        }}>
                            <div className="border border-blue-500 bg-white/80 p-1 whitespace-nowrap shadow-xl cursor-grabbing w-full h-full flex items-center justify-center overflow-hidden text-sm">
                                {dragData.element?.type === 'box' ? (
                                    <div className="w-full h-full border-2 border-black bg-black/5" />
                                ) : dragData.element?.type === 'image' ? (
                                    dragData.element?.imageBase64 ?
                                        <img src={dragData.element.imageBase64} className="w-full h-full object-contain opacity-50" /> :
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
