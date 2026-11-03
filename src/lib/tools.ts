import { newId } from './templateIO';
import { type TemplateElement } from '../types';

export type ToolType = 'text' | 'box' | 'line' | 'barcode' | 'qr' | 'image';

export function createElement(tool: ToolType, x: number, y: number, pageWidth: number, defaultText = 'Text'): TemplateElement {
  const base = { id: newId(), x, y };
  switch (tool) {
    case 'text':
      return { ...base, type: 'text', width: 30, height: 3.6, fontSize: 3, content: defaultText };
    case 'box':
      return { ...base, type: 'box', width: 20, height: 10, thickness: 0.25 };
    case 'line':
      return { ...base, x: 0, type: 'box', width: pageWidth, height: 0.25, thickness: 0.25 };
    case 'barcode':
      return { ...base, type: 'barcode', barcodeType: 'code128', width: 40, height: 10, moduleWidth: 2, showLabel: true, content: '12345678' };
    case 'qr':
      return { ...base, type: 'barcode', barcodeType: 'qr', width: 20, height: 20, magnification: 4, content: 'QR' };
    case 'image':
      return { ...base, type: 'image', width: 20, height: 10 };
  }
}
