// Canvas pixels per millimetre (96 dpi CSS pixels).
export const MM_TO_PX = 96 / 25.4;

export const mmToPx = (mm: number) => mm * MM_TO_PX;
export const pxToMm = (px: number) => px / MM_TO_PX;
// Zebra resolutions are exactly 8, 12 and 24 dots per millimetre.
const DOTS_PER_MM: Record<number, number> = { 203: 8, 300: 12, 600: 24 };
export const dotsPerMm = (dpi: number) => DOTS_PER_MM[dpi] ?? dpi / 25.4;
export const mmToDots = (mm: number, dpi: number) => Math.round(mm * dotsPerMm(dpi));

/** Rounds a millimetre value to 0.1 mm to keep templates readable. */
export const roundMm = (mm: number) => Math.round(mm * 10) / 10;

export const PAPER_PRESETS_MM = [48, 72, 104];
export const DPI_OPTIONS = [203, 300, 600] as const;
export const PREVIEW_LOCALES = ['tr-TR', 'en-US', 'en-GB', 'de-DE', 'fr-FR'];
