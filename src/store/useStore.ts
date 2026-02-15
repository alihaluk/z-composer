import { create } from 'zustand';
import { temporal } from 'zundo';
import { type CanvasElement, type SectionName, type SectionState } from '../types';

interface SavedTemplate {
  name: string;
  data: {
    header: SectionState;
    body: SectionState;
    footer: SectionState;
    canvasWidth: number;
  };
  createdAt: string;
}

interface AppState {
  header: SectionState;
  body: SectionState;
  footer: SectionState;
  selectedElementId: string | null;
  selectedSection: SectionName | null;

  // Preview State
  previewMode: 'zpl' | 'text';
  setPreviewMode: (mode: 'zpl' | 'text') => void;

  currentTemplateName: string | null;

  // Templates
  savedTemplates: SavedTemplate[];
  saveTemplate: (name: string) => void;
  deleteTemplate: (name: string) => void;
  loadTemplate: (name: string) => void;

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
  setCurrentTemplateName: (name: string | null) => void;
}

export const useStore = create<AppState>()(
  temporal(
    (set, get) => ({
      header: { height: 40, elements: [] },
      body: { height: 10, elements: [] },
      footer: { height: 20, elements: [] },
      selectedElementId: null,
      selectedSection: null,
      canvasWidth: 104, // Default 104mm (4 inch)
      previewMode: 'zpl',
      savedTemplates: JSON.parse(localStorage.getItem('zcomposer_templates') || '[]'),
      currentTemplateName: null,

      setPreviewMode: (mode) => set({ previewMode: mode }),

      saveTemplate: (name) => {
        const { header, body, footer, canvasWidth, savedTemplates } = get();
        const newTemplate: SavedTemplate = {
          name,
          data: { header, body, footer, canvasWidth },
          createdAt: new Date().toISOString()
        };
        const updatedTemplates = [...savedTemplates.filter(t => t.name !== name), newTemplate];
        localStorage.setItem('zcomposer_templates', JSON.stringify(updatedTemplates));
        set({ savedTemplates: updatedTemplates, currentTemplateName: name });
      },

      deleteTemplate: (name) => {
        const { savedTemplates, currentTemplateName } = get();
        const updatedTemplates = savedTemplates.filter(t => t.name !== name);
        localStorage.setItem('zcomposer_templates', JSON.stringify(updatedTemplates));
        set({
          savedTemplates: updatedTemplates,
          currentTemplateName: currentTemplateName === name ? null : currentTemplateName
        });
      },

      loadTemplate: (name) => {
        const { savedTemplates } = get();
        const template = savedTemplates.find(t => t.name === name);
        if (template) {
          set({
            header: template.data.header,
            body: template.data.body,
            footer: template.data.footer,
            canvasWidth: template.data.canvasWidth,
            selectedElementId: null,
            selectedSection: null,
            currentTemplateName: name
          });
        }
      },

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
        selectedSection: null,
        currentTemplateName: null
      }),

      setCanvasWidth: (width) => set({ canvasWidth: Math.max(10, Math.min(104, width)) }),

      zoomLevel: 1.25, // Default slightly zoomed in as requested
      setZoomLevel: (zoom) => set({ zoomLevel: Math.max(0.25, Math.min(3, zoom)) }),

      setTemplate: (template) => set({
        header: template.header,
        body: template.body,
        footer: template.footer,
        canvasWidth: template.canvasWidth || 104,
        // Reset selection and template name
        selectedElementId: null,
        selectedSection: null,
        currentTemplateName: null
      }),

      setCurrentTemplateName: (name) => set({ currentTemplateName: name }),
    }),
    {
      partialize: (state) => {
        const { header, body, footer, canvasWidth, previewMode } = state;
        return { header, body, footer, canvasWidth, previewMode };
      },
      limit: 50
    }
  )
);
