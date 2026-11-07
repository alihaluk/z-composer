// Random damage to templates and catalogs, as an edited or truncated file would bring: import either
// refuses them with an error or the template can be generated, filled and checked without throwing.
import { describe, expect, it } from 'vitest';
import { parseCatalog, missingFields } from './catalogIO';
import { checkDesign } from './designCheck';
import { fieldRefs } from './fieldElements';
import { PRESETS } from './presets';
import { parseTemplate } from './templateIO';
import { fillTemplate } from './zplFill';
import { generateTemplateZpl } from './zplTemplate';
import { parseZpl } from '../preview/zplParser';

/** Small seeded PRNG (mulberry32), so a failure can be reproduced. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JUNK: unknown[] = [null, -1, 0, 1e9, -1e9, 0.0001, '', 'x', '{{a}}', '^XZ~', [], {}, true, 'Ünicode İı 😀', 'a'.repeat(5000), NaN];

/** Every container path in a JSON value. */
function containers(value: unknown, path: (string | number)[] = [], out: (string | number)[][] = []) {
  if (value && typeof value === 'object') {
    out.push(path);
    for (const [k, v] of Object.entries(value)) containers(v, [...path, Array.isArray(value) ? Number(k) : k], out);
  }
  return out;
}

function mutate(source: unknown, rnd: () => number): unknown {
  const value = structuredClone(source);
  const all = containers(value);
  for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
    const path = all[Math.floor(rnd() * all.length)];
    const target = path.reduce<unknown>((o, k) => (o as Record<string | number, unknown>)?.[k], value) as Record<string, unknown> | unknown[] | undefined;
    if (!target || typeof target !== 'object') continue;
    const keys = Object.keys(target);
    if (!keys.length) continue;
    const key = keys[Math.floor(rnd() * keys.length)];
    if (rnd() < 0.3 && !Array.isArray(target)) delete (target as Record<string, unknown>)[key];
    else (target as Record<string, unknown>)[key] = JUNK[Math.floor(rnd() * JUNK.length)];
  }
  // As a file would carry it (NaN becomes null).
  return JSON.parse(JSON.stringify(value));
}

describe('damaged template files', () => {
  it.each(PRESETS.map(p => p.id))('%s: refused with an error, or usable', id => {
    const preset = PRESETS.find(p => p.id === id)!;
    const source = JSON.parse(JSON.stringify(preset.build()));
    const rnd = random(id.length * 7919);
    let refused = 0;
    for (let i = 0; i < 2000; i++) {
      const damaged = mutate(source, rnd);
      let template;
      try {
        template = parseTemplate(damaged);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message.length).toBeGreaterThan(0);
        refused++;
        continue;
      }
      const zpl = generateTemplateZpl(template);
      expect(zpl.startsWith('^XA')).toBe(true);
      // The preview parses both the template and the filled label.
      parseZpl(zpl);
      parseZpl(fillTemplate(zpl, preset.catalog.sample, { locale: 'tr-TR', image: () => null }));
      checkDesign(template, preset.catalog, 'tr-TR', { x: 100 });
      missingFields(template, preset.catalog);
    }
    // Both outcomes are exercised.
    expect(refused).toBeGreaterThan(0);
    expect(refused).toBeLessThan(2000);
  });
});

describe('damaged catalog files', () => {
  it.each(PRESETS.map(p => p.id))('%s: refused with an error, or usable', id => {
    const preset = PRESETS.find(p => p.id === id)!;
    const template = preset.build();
    const rnd = random(id.length * 104729);
    for (let i = 0; i < 1000; i++) {
      const damaged = mutate(preset.catalog, rnd);
      let catalog;
      try {
        catalog = parseCatalog(damaged);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        continue;
      }
      fieldRefs(catalog);
      checkDesign(template, catalog, 'tr-TR');
      missingFields(template, catalog);
      fillTemplate(generateTemplateZpl(template), catalog.sample, { locale: 'tr-TR', image: () => null });
    }
  });
});
