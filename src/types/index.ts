export type ElementType = 'text' | 'box';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  isDynamic: boolean;
  dataSource?: string;
  fontSize?: number;
  fontBold?: boolean;
  rotation?: number;
  maxChars?: number;
}

export interface SectionState {
  height: number;
  elements: CanvasElement[];
}

export type SectionName = 'header' | 'body' | 'footer';
