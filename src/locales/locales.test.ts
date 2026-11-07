import { describe, expect, it } from 'vitest';
import en from './en.json';
import tr from './tr.json';

type Tree = { [key: string]: string | Tree };
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.fromEntries(Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[prefix + k, v]] : Object.entries(flatten(v, `${prefix}${k}.`)))));
const vars = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();

describe('translations', () => {
  const english = flatten(en as Tree);
  const turkish = flatten(tr as Tree);

  it('have the same keys', () => {
    expect(Object.keys(turkish).sort()).toEqual(Object.keys(english).sort());
  });

  it('have no empty texts', () => {
    expect(Object.entries({ ...english, ...turkish }).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it('use the same placeholders in both languages', () => {
    const differ = Object.keys(english).filter(k => JSON.stringify(vars(english[k])) !== JSON.stringify(vars(turkish[k] ?? '')));
    expect(differ).toEqual([]);
  });
});

describe('translation keys used in the code', () => {
  it('all exist', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !f.endsWith('.test.ts')) files.push(p); } };
    walk('src');
    const english = flatten(en as Tree);
    const used = new Set(files.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([\w.]+)'/g)].map(m => m[1])));
    // Keys with plural forms are stored with a suffix.
    const missing = [...used].filter(k => !(k in english) && !(`${k}_one` in english));
    expect(missing).toEqual([]);
  });
});
