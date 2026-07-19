export type Tool = 'select' | 'pin' | 'box';
export type Strength = 'exact' | 'near' | 'flexible' | 'reference';
export type ElementType = 'pin' | 'box';
export interface MapElement {
  id: string;
  label: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  prompt: string;
  strength: Strength;
  allowOverflow: boolean;
  preserveAspectRatio: boolean;
}
export interface ProjectData {
  version: 1;
  name: string;
  globalPrompt: string;
  imageName?: string;
  elements: MapElement[];
}
