import { describe, expect, it } from 'vitest';
import { generateElementZPL, generateZPL } from './zplGenerator';
import { type CanvasElement, type SectionState } from '../types';

// Baseline tests: they pin the current (v1) output so later changes are deliberate.
// Coordinates are canvas px (MM_TO_PX = 3.78) converted to 8 dots/mm.

const el = (overrides: Partial<CanvasElement>): CanvasElement => ({
  id: 'e1',
  type: 'text',
  x: 10,
  y: 20,
  isDynamic: false,
  ...overrides,
});

const section = (height: number, elements: CanvasElement[] = []): SectionState => ({ height, elements });

describe('generateElementZPL', () => {
  it('renders static text with position and font size in dots', () => {
    expect(generateElementZPL(el({ content: 'Hello', fontSize: 12 }))).toBe('^FO21,42^A0N,34,34^FDHello^FS\n');
  });

  it('renders a dynamic text field as a [Path] marker in template mode', () => {
    expect(generateElementZPL(el({ isDynamic: true, dataSource: 'Customer.Name' }))).toContain('^FD[Customer.Name]^FS');
  });

  it('resolves a dynamic text field from mock data in preview mode', () => {
    expect(generateElementZPL(el({ isDynamic: true, dataSource: 'Customer.Name' }), true)).toContain('^FDJohn Doe^FS');
  });

  it('prefers row data over global mock data', () => {
    const zpl = generateElementZPL(el({ isDynamic: true, dataSource: 'Total' }), true, 0, { Total: '42.00' });
    expect(zpl).toContain('^FD42.00^FS');
  });

  it('truncates static text to maxChars with an ellipsis', () => {
    expect(generateElementZPL(el({ content: 'Hello', maxChars: 3 }))).toContain('^FDHel...^FS');
  });

  it('does not truncate markers in template mode', () => {
    const zpl = generateElementZPL(el({ isDynamic: true, dataSource: 'Customer.Name', maxChars: 3 }));
    expect(zpl).toContain('^FD[Customer.Name]^FS');
  });

  it('maps rotation to the ZPL orientation', () => {
    expect(generateElementZPL(el({ content: 'R', rotation: 90 }))).toContain('^A0R,');
    expect(generateElementZPL(el({ content: 'I', rotation: 180 }))).toContain('^A0I,');
    expect(generateElementZPL(el({ content: 'B', rotation: 270 }))).toContain('^A0B,');
  });

  it('adds the section offset in mm to the y position', () => {
    expect(generateElementZPL(el({ content: 'x' }), false, 10)).toMatch(/^\^FO21,122\^/);
  });

  it('renders a box as ^GB with a 2-dot border', () => {
    expect(generateElementZPL(el({ type: 'box', width: 100, height: 50 }))).toBe('^FO21,42^GB212,106,2^FS\n');
  });

  it('renders a Code 128 barcode with height and interpretation line', () => {
    const zpl = generateElementZPL(el({ type: 'barcode', content: '12345678', height: 50, showLabel: true }));
    expect(zpl).toBe('^FO21,42^BCN,106,Y,N,N^FD12345678^FS\n');
  });

  it('renders a QR code with a magnification derived from its width', () => {
    const zpl = generateElementZPL(el({ type: 'barcode', barcodeType: 'qr', width: 80, isDynamic: true, dataSource: 'GibInfo' }));
    expect(zpl).toBe('^FO21,42^BQN,2,3^FDQA,[GibInfo]^FS\n');
  });

  it('renders an image without data as a placeholder box and key label', () => {
    const zpl = generateElementZPL(el({ type: 'image', width: 60, height: 60, imageKey: 'TenantLogo' }));
    expect(zpl).toContain('^GB127,127,1^FS');
    expect(zpl).toContain('^FD[IMG:TenantLogo]^FS');
  });

  it('embeds uploaded image data as ^GFA', () => {
    const zpl = generateElementZPL(el({ type: 'image', zplImage: { hex: 'FF00', totalBytes: 2, bytesPerRow: 1 } }));
    expect(zpl).toBe('^FO21,42^GFA,2,2,1,FF00^FS\n');
  });

  // Known defects, fixed in roadmap step 5 (docs/SCOPE.md).
  it.todo('escapes ^ and ~ in field data with ^FH');
  it.todo('prints bold text differently from regular text');
});

describe('generateZPL', () => {
  const header = section(40, [el({ id: 'h', content: 'Head' })]);
  const body = section(10, [el({ id: 'b', y: 0, isDynamic: true, dataSource: 'Product.Name' })]);
  const footer = section(20, [el({ id: 'f', y: 0, content: 'Foot' })]);

  it('wraps the label with ^XA/^XZ and selects UTF-8', () => {
    const zpl = generateZPL(header, body, footer);
    expect(zpl.startsWith('^XA\n^CI28\n')).toBe(true);
    expect(zpl.endsWith('^XZ')).toBe(true);
  });

  it('sets print width and label length in dots', () => {
    const zpl = generateZPL(header, body, footer, 1, false, 80);
    expect(zpl).toContain('^PW640\n');
    expect(zpl).toContain('^LL560\n');
  });

  it('marks a single body row with loop markers in template mode', () => {
    const zpl = generateZPL(header, body, footer);
    expect(zpl).toContain('^FX LOOP START height=10\n^FO21,320^A0N,34,34^FD[Product.Name]^FS\n^FX LOOP END\n');
  });

  it('places the footer after header and one body row in template mode', () => {
    expect(generateZPL(header, body, footer)).toContain('^FO21,400^A0N,34,34^FDFoot^FS');
  });

  it('repeats body rows with mock data and no loop markers in preview mode', () => {
    const zpl = generateZPL(header, body, footer, 3, true);
    expect(zpl).not.toContain('LOOP');
    expect(zpl).toContain('^LL720\n');
    expect(zpl).toContain('^FO21,320^A0N,34,34^FDLaptop^FS');
    expect(zpl).toContain('^FO21,400^A0N,34,34^FDMouse^FS');
    expect(zpl).toContain('^FO21,480^A0N,34,34^FDLaptop^FS');
    expect(zpl).toContain('^FO21,560^A0N,34,34^FDFoot^FS');
  });
});
