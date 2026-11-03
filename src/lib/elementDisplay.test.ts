import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from './catalog';
import { displayText, hiddenInSample, sampleGrowth } from './elementDisplay';
import { type Band } from '../types';

const lines: Band = {
  id: 'l', name: 'Lines', repeat: 'Lines', height: 4.5,
  elements: [
    { id: 'n', type: 'text', x: 2, y: 0.8, width: 33, height: 3.2, fontSize: 2.6, isDynamic: true, dataSource: 'Product.Name', overflow: 'wrap', maxLines: 3, grow: true, charsPerLine: 10 },
    { id: 't', type: 'text', x: 58, y: 0.8, width: 12, height: 3.2, fontSize: 2.6, isDynamic: true, dataSource: 'Total', format: 'N2', align: 'right' },
  ],
};

describe('displayText', () => {
  it('shows field names or formatted sample values of the first item', () => {
    expect(displayText(lines.elements[1], lines, DEFAULT_CATALOG, 'fields', 'tr-TR')).toBe('[Total]');
    expect(displayText(lines.elements[1], lines, DEFAULT_CATALOG, 'sample', 'tr-TR')).toBe('1.200,50');
    expect(displayText(lines.elements[1], lines, DEFAULT_CATALOG, 'sample', 'en-US')).toBe('1,200.50');
  });
});

describe('sampleGrowth', () => {
  it('wraps growing text like the filler and grows the band by the extra lines', () => {
    const g = sampleGrowth(lines, DEFAULT_CATALOG, 'sample', 'tr-TR', 203);
    // "Süt 1L" fits in one line of 10 characters, so the first item does not grow.
    expect(g).toEqual({ elementId: 'n', lines: ['Süt 1L'], growY: 0.8, extraMm: 0 });
    const long = { ...lines, elements: [{ ...lines.elements[0], charsPerLine: 4 }] };
    const g2 = sampleGrowth(long, DEFAULT_CATALOG, 'sample', 'tr-TR', 203);
    expect(g2.lines).toEqual(['Süt', '1L']);
    expect(g2.extraMm).toBe(24 / 8);
  });

  it('does not grow in field-name mode', () => {
    expect(sampleGrowth(lines, DEFAULT_CATALOG, 'fields', 'tr-TR', 203)).toEqual({ growY: 0, extraMm: 0 });
  });
});

describe('hiddenInSample', () => {
  it('evaluates conditions against the sample data', () => {
    const band: Band = { id: 'b', name: 'T', height: 5, elements: [] };
    const el = { id: 'd', type: 'text' as const, x: 0, y: 0, width: 1, height: 1, condition: { path: 'Totals.Discount', op: 'notZero' as const } };
    expect(hiddenInSample(el, band, DEFAULT_CATALOG, 'sample')).toBe(true);
    expect(hiddenInSample(el, band, DEFAULT_CATALOG, 'fields')).toBe(false);
  });
});
