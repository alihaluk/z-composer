import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fillTemplate } from './zplFill';

// Runs the conformance suite (conformance/README.md) against the reference filler.
interface Case {
  id: string;
  locale: string;
  lineEnding?: 'lf' | 'crlf';
  template: string[];
  data: unknown;
  images?: Record<string, string>;
  expected?: string[];
  error?: boolean;
}

const dir = new URL('../../conformance/cases/', import.meta.url);
const cases = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Case] as const);

/** Comparison rule of the suite: line by line, without empty lines and marker lines. */
const normalize = (zpl: string) => zpl.split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('^FX'));

describe('conformance suite', () => {
  it('has cases', () => expect(cases.length).toBeGreaterThan(0));

  it.each(cases)('%s', (_, c) => {
    const template = c.template.join(c.lineEnding === 'crlf' ? '\r\n' : '\n');
    const fill = () => fillTemplate(template, c.data, { locale: c.locale, image: key => c.images?.[key] ?? null });
    if (c.error) expect(fill).toThrow();
    else expect(normalize(fill())).toEqual(c.expected);
  });
});
