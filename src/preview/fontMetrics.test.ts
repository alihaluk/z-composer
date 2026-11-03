import { describe, expect, it } from 'vitest';
import { A0_ADVANCE, A0_AVERAGE_ADVANCE, a0Width, fieldBlockLines } from './fontMetrics';

describe('^A0 width table', () => {
  it('covers digits, Latin and Turkish letters', () => {
    for (const c of '0123456789abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ .,:/') expect(A0_ADVANCE[c], c).toBeGreaterThan(0.2);
  });

  it('gives digits one width so amounts line up', () => {
    expect(new Set([...'0123456789'].map(d => A0_ADVANCE[d])).size).toBe(1);
  });

  it('measures text at a height and width, or returns null for unknown characters', () => {
    expect(a0Width('11', 40)).toBeCloseTo(2 * 0.478 * 40);
    expect(a0Width('1', 40, 20)).toBeCloseTo(0.478 * 20);
    expect(a0Width('1-1', 40)).toBeNull();
  });

  it('has an average advance close to half the height', () => {
    expect(A0_AVERAGE_ADVANCE).toBeGreaterThan(0.4);
    expect(A0_AVERAGE_ADVANCE).toBeLessThan(0.55);
  });
});

describe('fieldBlockLines', () => {
  const widthOf = (s: string) => s.length * 10;

  it('breaks at spaces before a word would pass the width', () => {
    expect(fieldBlockLines('aa bb cc dd', 50, widthOf)).toEqual(['aa bb', 'cc dd']);
  });

  it('keeps a word longer than the block on its own line, like ^FB', () => {
    expect(fieldBlockLines('a verylongword b', 50, widthOf)).toEqual(['a', 'verylongword', 'b']);
  });

  it('starts a new line at a line break', () => {
    expect(fieldBlockLines('a\nb', 50, widthOf)).toEqual(['a', 'b']);
  });
});
