import { type GrayBitmap } from '../types';

export interface ZplGraphic {
  totalBytes: number;
  bytesPerRow: number;
  hex: string;
}

const MAX_SOURCE_SIZE = 600;
/** A larger ^GFA would take long to build and exceed what a printer can hold; the image is scaled down to this. */
const MAX_GRAPHIC_DOTS = 64_000_000;

/** Whether a stored image is embedded: a remote address would make the browser call that server. */
export const isImageDataUrl = (value: unknown) => typeof value === 'string' && /^data:image\/[a-z0-9.+-]+(;[^,]*)?,/i.test(value);

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/** Reads an image (file or data URL) into a grayscale bitmap; runs in the browser. */
export function loadGrayBitmap(source: File | string): Promise<{ bitmap: GrayBitmap; dataUrl: string }> {
  const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return (typeof source === 'string' ? Promise.resolve(source) : readDataUrl(source)).then(dataUrl => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SOURCE_SIZE / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context is not available'));
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const rgba = ctx.getImageData(0, 0, width, height).data;
      const gray = new Uint8Array(width * height);
      for (let i = 0; i < gray.length; i++) gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
      resolve({ bitmap: { width, height, data: toBase64(gray) }, dataUrl });
    };
    img.onerror = () => reject(new Error('Image could not be loaded'));
    img.src = dataUrl;
  }));
}

/**
 * Scales a grayscale bitmap to fit within the target size in dots (keeping its aspect
 * ratio) and encodes it as ZPL ^GFA data. Pixels darker than the threshold print.
 */
export function bitmapToZpl(bitmap: GrayBitmap, maxWidth: number, maxHeight: number, threshold = 128): ZplGraphic & { width: number; height: number } {
  const gray = fromBase64(bitmap.data);
  const fit = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height);
  const scale = Math.min(fit, Math.sqrt(MAX_GRAPHIC_DOTS / (bitmap.width * bitmap.height)));
  const width = Math.max(1, Math.floor(bitmap.width * scale));
  const height = Math.max(1, Math.floor(bitmap.height * scale));
  const bytesPerRow = Math.ceil(width / 8);
  let hex = '';
  for (let y = 0; y < height; y++) {
    const sy = Math.min(bitmap.height - 1, Math.floor(y / scale));
    for (let byteIndex = 0; byteIndex < bytesPerRow; byteIndex++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIndex * 8 + bit;
        if (x >= width) continue;
        const sx = Math.min(bitmap.width - 1, Math.floor(x / scale));
        if (gray[sy * bitmap.width + sx] < threshold) byte |= 0x80 >> bit;
      }
      hex += byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return { totalBytes: bytesPerRow * height, bytesPerRow, hex, width, height };
}
