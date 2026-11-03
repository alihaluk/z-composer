import { describe, expect, it } from 'vitest';
import { bitmapToZpl } from './imageUtils';

const bitmap = (width: number, height: number, pixels: number[]) => ({ width, height, data: btoa(String.fromCharCode(...pixels)) });

describe('bitmapToZpl', () => {
  it('packs dark pixels into bytes, padding rows to whole bytes', () => {
    // 2x2: black, white / white, black
    expect(bitmapToZpl(bitmap(2, 2, [0, 255, 255, 0]), 2, 2)).toEqual({ totalBytes: 2, bytesPerRow: 1, hex: '8040', width: 2, height: 2 });
  });

  it('scales to fit the target size and keeps the aspect ratio', () => {
    const g = bitmapToZpl(bitmap(2, 1, [0, 255]), 16, 16);
    expect([g.width, g.height]).toEqual([16, 8]);
    expect(g.hex.slice(0, 4)).toBe('FF00');
  });

  it('applies the threshold', () => {
    expect(bitmapToZpl(bitmap(1, 1, [150]), 1, 1, 128).hex).toBe('00');
    expect(bitmapToZpl(bitmap(1, 1, [150]), 1, 1, 200).hex).toBe('80');
  });
});
