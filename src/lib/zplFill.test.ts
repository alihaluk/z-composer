import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateCondition, fillTemplate, resolvePlaceholder, wrapText } from './zplFill';

// The worked example of the specification is the reference test: the document and the
// filler must agree.
const spec = readFileSync(new URL('../../docs/OUTPUT_SPEC.md', import.meta.url), 'utf8');
const exampleStart = spec.search(/^## \d+\. Example/m);
const example = spec.slice(exampleStart, spec.indexOf('\n## ', exampleStart + 5));
const blocks = [...example.matchAll(/```(\w+)\n([\s\S]*?)```/g)];
const [template, expected] = blocks.filter(b => b[1] === 'zpl').map(b => b[2].trimEnd());
const data = JSON.parse(blocks.find(b => b[1] === 'json')![2]);

describe('fillTemplate', () => {
  it('reproduces the worked example of the specification', () => {
    expect(fillTemplate(template, data, { locale: 'tr-TR' })).toBe(expected);
  });

  it('formats with the filler culture', () => {
    const out = fillTemplate(template, data, { locale: 'en-US' });
    expect(out).toContain('^FDTarih: 11/13/2026^FS');
    expect(out).toContain('^FD2,751.50 TRY^FS');
  });

  it('prints a conditional band and grows the length when its condition holds', () => {
    const out = fillTemplate(template, { ...data, Discount: -5 }, { locale: 'tr-TR' });
    expect(out).toContain('^FD-5,00^FS');
    expect(out).toContain('^LL346');
  });

  it('prints nothing for a missing repeat array', () => {
    const out = fillTemplate(template, { ...data, Lines: undefined }, { locale: 'tr-TR' });
    expect(out).not.toContain('Süt');
    expect(out).toContain('^LL168');
  });

  it('replaces or removes dynamic images', () => {
    const tpl = '^XA\n^LL10\n^FX ZC:BAND id=a height=10\n^LH0,0\n^FX ZC:IMAGE key=Logo width=8 height=8\n^FO1,2^GB8,8,1^FS\n^FX ZC:END\n^LH0,0\n^XZ';
    expect(fillTemplate(tpl, {}, { locale: 'tr-TR', image: () => '^GFA,1,1,1,FF' })).toContain('^FO1,2^GFA,1,1,1,FF^FS');
    expect(fillTemplate(tpl, {}, { locale: 'tr-TR' })).not.toContain('^GB8,8,1');
  });
});

describe('resolvePlaceholder', () => {
  it('reads root paths inside a repeating context', () => {
    expect(resolvePlaceholder('$.Currency', { Currency: 'item' }, { Currency: 'TRY' }, 'tr-TR')).toBe('TRY');
  });

  it('truncates after formatting and sanitizes control characters', () => {
    expect(resolvePlaceholder('A|max=3', { A: 'a\nbcd' }, {}, 'tr-TR')).toBe('a b');
  });

  it('formats with the invariant culture when asked', () => {
    expect(resolvePlaceholder('T|fmt=F2|inv', { T: 1234.5 }, {}, 'tr-TR')).toBe('1234.50');
  });
});

describe('evaluateCondition', () => {
  it.each([
    [undefined, 'notEmpty', false], ['  ', 'notEmpty', false], [[], 'notEmpty', false], ['x', 'notEmpty', true],
    [0, 'notZero', false], ['0', 'notZero', false], [undefined, 'notZero', false], [-5, 'notZero', true], ['2.5', 'notZero', true],
  ])('%j %s -> %s', (value, op, result) => {
    expect(evaluateCondition(value, op)).toBe(result);
  });
});

describe('wrapText', () => {
  it('breaks at spaces, splits long words and keeps at most maxLines', () => {
    expect(wrapText('Tam Yağlı Beyaz Peynir Ezine 1 kg Vakumlu', 24, 3)).toEqual(['Tam Yağlı Beyaz Peynir', 'Ezine 1 kg Vakumlu']);
    expect(wrapText('abcdefghij kl', 4, 5)).toEqual(['abcd', 'efgh', 'ij', 'kl']);
    expect(wrapText('a b c d e', 1, 2)).toEqual(['a', 'b']);
  });
});
