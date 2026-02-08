export type ElementType = 'text' | 'box' | 'barcode' | 'image';

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
  imageKey?: string; // e.g., 'TenantLogo', 'GibLogo', 'GibQRCode'
  fontSize?: number;
  fontBold?: boolean;
  rotation?: number;
  maxChars?: number;
  barcodeType?: 'code128' | 'qr';
  showLabel?: boolean;
}

export interface SectionState {
  height: number;
  elements: CanvasElement[];
}

export type SectionName = 'header' | 'body' | 'footer';
