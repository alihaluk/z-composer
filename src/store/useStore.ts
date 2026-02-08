import { create } from 'zustand';
import { temporal } from 'zundo';
import { type CanvasElement, type SectionName, type SectionState } from '../types';

interface AppState {
  header: SectionState;
  body: SectionState;
  footer: SectionState;
  selectedElementId: string | null;
  selectedSection: SectionName | null;

  // Actions
  addElement: (section: SectionName, element: CanvasElement) => void;
  updateElement: (section: SectionName, id: string, updates: Partial<CanvasElement>) => void;
  removeElement: (section: SectionName, id: string) => void;
  selectElement: (id: string | null, section: SectionName | null) => void;
  setSectionHeight: (section: SectionName, height: number) => void;
  clearCanvas: () => void;
  canvasWidth: number;
  setCanvasWidth: (width: number) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  setTemplate: (template: { header: SectionState; body: SectionState; footer: SectionState; canvasWidth: number }) => void;
}

export const useStore = create<AppState>()(
  temporal(
    (set) => ({
      header: { height: 40, elements: [] },
      body: { height: 10, elements: [] },
      footer: { height: 20, elements: [] },
      selectedElementId: null,
      selectedSection: null,
      canvasWidth: 104, // Default 104mm (4 inch)

      addElement: (section, element) =>
        set((state) => ({
          [section]: {
            ...state[section],
            elements: [...state[section].elements, element],
          },
        })),

      updateElement: (section, id, updates) =>
        set((state) => ({
          [section]: {
            ...state[section],
            elements: state[section].elements.map((el) =>
              el.id === id ? { ...el, ...updates } : el
            ),
          },
        })),

      removeElement: (section, id) =>
        set((state) => ({
          [section]: {
            ...state[section],
            elements: state[section].elements.filter((el) => el.id !== id),
          },
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        })),

      selectElement: (id, section) =>
        set({ selectedElementId: id, selectedSection: section }),

      setSectionHeight: (section, height) =>
        set((state) => ({
          [section]: { ...state[section], height: Math.max(1, Math.min(500, height)) },
        })),

      clearCanvas: () => set({
        header: { height: 40, elements: [] },
        body: { height: 10, elements: [] },
        footer: { height: 20, elements: [] },
        selectedElementId: null,
        selectedSection: null
      }),

      setCanvasWidth: (width) => set({ canvasWidth: Math.max(10, Math.min(104, width)) }),

      zoomLevel: 1.25, // Default slightly zoomed in as requested
      setZoomLevel: (zoom) => set({ zoomLevel: Math.max(0.25, Math.min(3, zoom)) }),

      setTemplate: (template) => set({
        header: template.header,
        body: template.body,
        footer: template.footer,
        canvasWidth: template.canvasWidth || 104,
        // Reset selection
        selectedElementId: null,
        selectedSection: null
      }),
    }),
    {
      partialize: (state) => {
        const { header, body, footer, canvasWidth } = state;
        return { header, body, footer, canvasWidth };
      },
      limit: 50
    }
  )
);
