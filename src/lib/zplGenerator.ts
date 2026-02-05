import { type SectionState, type CanvasElement } from '../types';
import { MM_TO_PX } from './constants';

const DOTS_PER_MM = 8;
const PX_TO_MM = 1 / MM_TO_PX;

function pxToDots(px: number): number {
  return Math.round(px * PX_TO_MM * DOTS_PER_MM);
}

function mmToDots(mm: number): number {
  return Math.round(mm * DOTS_PER_MM);
}

function ptToDots(pt: number): number {
  return Math.round(pt * (203 / 72));
}

function getOrientation(rotation: number = 0): string {
    switch (rotation) {
        case 90: return 'R';
        case 180: return 'I';
        case 270: return 'B';
        default: return 'N';
    }
}

const MOCK_DATA_ROWS = [
    { 'Line.ProductCode': 'P-101', 'Line.Price': '10.00', 'Line.Qty': '1', 'Line.Total': '10.00' },
    { 'Line.ProductCode': 'P-102', 'Line.Price': '25.50', 'Line.Qty': '2', 'Line.Total': '51.00' },
    { 'Line.ProductCode': 'P-103', 'Line.Price': '5.99', 'Line.Qty': '5', 'Line.Total': '29.95' },
    { 'Line.ProductCode': 'P-104', 'Line.Price': '100.00', 'Line.Qty': '1', 'Line.Total': '100.00' },
];

const MOCK_GLOBAL_DATA: Record<string, string> = {
    'Invoice.Date': '2023-10-27',
    'Customer.Name': 'John Doe',
    'Invoice.Total': '190.95'
};

export function generateZPL(
  header: SectionState,
  body: SectionState,
  footer: SectionState,
  mockItems: number = 3
): string {
  let zpl = '^XA\n^CI28\n'; // Start, UTF-8

  // 1. Calculate Total Height for ^LL
  // Header + Body * N + Footer
  const totalHeightMm = header.height + (body.height * mockItems) + footer.height;
  zpl += `^LL${mmToDots(totalHeightMm)}\n`;
  zpl += `^PW${mmToDots(104)}\n`; // Print Width (4 inch)

  // Helper to render an element at offsetY (mm)
  const renderElement = (el: CanvasElement, offsetYMm: number, localData?: any) => {
      const xDots = pxToDots(el.x);
      const yDots = mmToDots(offsetYMm) + pxToDots(el.y);
      const fontSizeDots = ptToDots(el.fontSize || 12);

      let command = `^FO${xDots},${yDots}`;

      if (el.type === 'box') {
          const wDots = pxToDots(el.width || 0);
          const hDots = pxToDots(el.height || 0);
          command += `^GB${wDots},${hDots},2^FS`; // Border thickness 2
      } else {
          // Text
          const orientation = getOrientation(el.rotation);
          command += `^A0${orientation},${fontSizeDots},${fontSizeDots}`;

          let content = el.content || '';
          if (el.isDynamic && el.dataSource) {
              // Mock data injection
              const dataSource = el.dataSource;
              if (localData && localData[dataSource]) {
                  content = localData[dataSource];
              } else if (MOCK_GLOBAL_DATA[dataSource]) {
                  content = MOCK_GLOBAL_DATA[dataSource];
              } else {
                  content = `[${dataSource}]`;
              }
          }

          // Basic truncation/max chars
          if (el.maxChars && content.length > el.maxChars) {
              content = content.substring(0, el.maxChars) + '...';
          }

          command += `^FD${content}^FS`;
      }
      return command + '\n';
  };

  // 2. Render Header
  header.elements.forEach(el => {
      zpl += renderElement(el, 0);
  });

  // 3. Render Body (Loop)
  for (let i = 0; i < mockItems; i++) {
      const rowOffsetMm = header.height + (i * body.height);
      const mockRowData = MOCK_DATA_ROWS[i % MOCK_DATA_ROWS.length];

      body.elements.forEach(el => {
          zpl += renderElement(el, rowOffsetMm, mockRowData);
      });
  }

  // 4. Render Footer
  const footerOffsetMm = header.height + (mockItems * body.height);
  footer.elements.forEach(el => {
      zpl += renderElement(el, footerOffsetMm);
  });

  zpl += '^XZ';
  return zpl;
}
