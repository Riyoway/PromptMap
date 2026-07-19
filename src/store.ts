import { create } from 'zustand';
import type { MapElement, Tool, ProjectData } from './types';

type State = {
  tool: Tool;
  elements: MapElement[];
  selectedIds: string[];
  globalPrompt: string;
  projectName: string;
  setTool: (tool: Tool) => void;
  addElement: (element: MapElement) => void;
  updateElement: (id: string, patch: Partial<MapElement>) => void;
  removeElement: (id: string) => void;
  select: (id?: string, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  removeSelected: () => void;
  removeAll: () => void;
  setGlobalPrompt: (value: string) => void;
  setProjectName: (value: string) => void;
  loadProject: (project: ProjectData) => void;
  clear: () => void;
};

export const useAppStore = create<State>((set) => ({
  tool: 'select', elements: [], selectedIds: [], globalPrompt: '', projectName: 'Untitled map',
  setTool: (tool) => set({ tool }),
  addElement: (element) => set((s) => ({
    elements: [...s.elements, element],
    selectedIds: [element.id],
    // Pin is a repeat-placement tool. Regions remain a one-shot drag action.
    tool: s.tool === 'pin' ? 'pin' : 'select'
  })),
  updateElement: (id, patch) => set((s) => ({ elements: s.elements.map((e) => e.id === id ? { ...e, ...patch } : e) })),
  removeElement: (id) => set((s) => ({ elements: s.elements.filter((e) => e.id !== id), selectedIds: s.selectedIds.filter((selectedId) => selectedId !== id) })),
  select: (id, additive = false) => set((s) => {
    if (!id) return { selectedIds: [] };
    if (!additive) return { selectedIds: [id] };
    return { selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((selectedId) => selectedId !== id) : [...s.selectedIds, id] };
  }),
  selectMany: (selectedIds) => set({ selectedIds }),
  selectAll: () => set((s) => ({ selectedIds: s.elements.map((element) => element.id) })),
  removeSelected: () => set((s) => {
    const selected = new Set(s.selectedIds);
    return { elements: s.elements.filter((element) => !selected.has(element.id)), selectedIds: [] };
  }),
  removeAll: () => set({ elements: [], selectedIds: [] }),
  setGlobalPrompt: (globalPrompt) => set({ globalPrompt }),
  setProjectName: (projectName) => set({ projectName }),
  loadProject: (p) => set({ projectName: p.name, globalPrompt: p.globalPrompt, elements: p.elements, selectedIds: [], tool: 'select' }),
  clear: () => set({ elements: [], selectedIds: [], globalPrompt: '', projectName: 'Untitled map', tool: 'select' })
}));
