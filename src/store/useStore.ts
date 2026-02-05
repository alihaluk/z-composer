import { create } from 'zustand';
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
}

export const useStore = create<AppState>((set) => ({
  header: { height: 40, elements: [] },
  body: { height: 10, elements: [] },
  footer: { height: 20, elements: [] },
  selectedElementId: null,
  selectedSection: null,

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
      [section]: { ...state[section], height },
    })),
}));
