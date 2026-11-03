// Template model v2 (docs/SCOPE.md). All positions and sizes are in millimetres;
// they are converted to printer dots only when ZPL is generated.

export type ElementType = 'text' | 'box' | 'barcode' | 'image';
export type Rotation = 0 | 90 | 180 | 270;
export type Align = 'left' | 'center' | 'right';
export type ConditionOp = 'notEmpty' | 'notZero';
export type OverflowMode = 'none' | 'truncate' | 'wrap';
export type Dpi = 203 | 300 | 600;

export interface Condition {
  path: string;
  op: ConditionOp;
}

export interface GrayBitmap {
  width: number;
  height: number;
  /** Base64 of one byte per pixel, 0 = black, 255 = white. */
  data: string;
}

/** One piece of composed content: static text, or a catalog field with its own options. */
export type ContentPart = { text: string } | FieldPart;

export interface FieldPart {
  path: string;
  /** Format code (docs/OUTPUT_SPEC.md section 6). */
  format?: string;
  invariant?: boolean;
  /** Maximum characters of this value. */
  max?: number;
}

export interface TemplateElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  condition?: Condition;

  // Text and barcode content: static text, or a field of the catalog.
  isDynamic?: boolean;
  content?: string;
  dataSource?: string;
  /** Format code (docs/OUTPUT_SPEC.md section 6). */
  format?: string;
  /** Format with the invariant culture. */
  invariant?: boolean;
  /** Composed content of a dynamic element: static text and fields in order; replaces `dataSource`. */
  parts?: ContentPart[];

  // Text
  /** Character height in millimetres. */
  fontSize?: number;
  fontBold?: boolean;
  rotation?: Rotation;
  align?: Align;
  overflow?: OverflowMode;
  maxChars?: number;
  maxLines?: number;
  /** Wrapped text grows its band (docs/OUTPUT_SPEC.md section 9). */
  grow?: boolean;
  charsPerLine?: number;

  // Box
  /** Border thickness in millimetres; boxes thicker than half their size are filled. */
  thickness?: number;

  // Barcode
  barcodeType?: 'code128' | 'qr';
  showLabel?: boolean;
  /** Code 128 narrow bar width in dots. */
  moduleWidth?: number;
  /** QR module size in dots. */
  magnification?: number;

  // Image: a dynamic image key, or an uploaded image.
  imageKey?: string;
  imageBase64?: string;
  bitmap?: GrayBitmap;
  threshold?: number;
}

export interface Band {
  id: string;
  name: string;
  /** Array field of the catalog this band repeats for; static when absent. */
  repeat?: string;
  height: number;
  condition?: Condition;
  elements: TemplateElement[];
}

export interface PrinterProfile {
  /** Printable width in millimetres (^PW). */
  widthMm: number;
  dpi: Dpi;
}

export interface Template {
  schemaVersion: 2;
  printer: PrinterProfile;
  bands: Band[];
  /** Snapshot of the catalog fields the template uses (docs/SCOPE.md D2). */
  fieldsUsed?: { path: string; type: string }[];
}
