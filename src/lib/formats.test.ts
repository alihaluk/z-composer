import { describe, expect, it } from 'vitest';
import { formatValue } from './formats';

describe('formatValue', () => {
  it.each([
    ['N2', 1234.5, 'tr-TR', '1.234,50'], ['N2', 1234.5, 'en-US', '1,234.50'], ['F2', '1234.5', 'tr-TR', '1234,50'],
    ['N0', 1234.5, 'en-US', '1,235'], ['N2', -5, 'tr-TR', '-5,00'],
  ])('%s of %j in %s', (fmt, value, locale, expected) => {
    expect(formatValue(value, fmt, locale)).toBe(expected);
  });

  it.each([
    ['d', 'tr-TR', '13.11.2026'], ['d', 'en-US', '11/13/2026'], ['D', 'tr-TR', '13 Kasım 2026 Cuma'],
    ['t', 'tr-TR', '14:37'], ['t', 'en-US', '2:37 PM'], ['g', 'tr-TR', '13.11.2026 14:37'],
    ['dd.MM.yyyy', 'en-US', '13.11.2026'], ['yy-M-d H:mm:ss', 'tr-TR', '26-11-13 14:37:00'],
  ])('%s in %s', (fmt, locale, expected) => {
    expect(formatValue('2026-11-13T14:37:00', fmt, locale)).toBe(expected);
  });

  it('prints the clock time as written, ignoring offsets', () => {
    expect(formatValue('2026-11-13T23:30:00+03:00', 't', 'tr-TR')).toBe('23:30');
  });

  it('uses the invariant culture when asked', () => {
    expect(formatValue(1234.5, 'N2', 'tr-TR', true)).toBe('1,234.50');
  });

  it('returns null when the format does not fit the value', () => {
    expect(formatValue('abc', 'N2', 'tr-TR')).toBeNull();
    expect(formatValue(12, 'd', 'tr-TR')).toBeNull();
    expect(formatValue('2026-11-13', 'X', 'tr-TR')).toBeNull();
  });
});

describe('canonicalCulture', async () => {
  const { canonicalCulture } = await import('./formats');
  it.each([['tr-tr', 'tr-TR'], ['en-US', 'en-US'], ['de', 'de'], ['not a culture', null], ['', null]])('%s -> %s', (input, expected) => {
    expect(canonicalCulture(input)).toBe(expected);
  });
});
