import { describe, expect, it } from 'vitest';
import { ru } from '../../src/i18n/ru';
import { uz } from '../../src/i18n/uz';
import { en } from '../../src/i18n/en';

type Tree = string | readonly Tree[] | { readonly [key: string]: Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  if (typeof tree === 'string') return { [prefix]: tree };
  const entries = Array.isArray(tree)
    ? tree.map((value, index) => [String(index), value] as const)
    : Object.entries(tree);
  return Object.assign(
    {},
    ...entries.map(([key, value]) => flatten(value as Tree, prefix ? `${prefix}.${key}` : key)),
  );
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const reference = flatten(ru);

describe('UI dictionaries', () => {
  it('ru has no empty values', () => {
    const empty = Object.entries(reference).filter(([, value]) => value.trim() === '');
    expect(empty).toEqual([]);
  });

  for (const [name, dictionary] of Object.entries({ uz, en })) {
    const flat = flatten(dictionary as Tree);

    it(`${name} has exactly the keys of ru`, () => {
      expect(Object.keys(flat).sort()).toEqual(Object.keys(reference).sort());
    });

    it(`${name} has no empty values`, () => {
      const empty = Object.entries(flat).filter(([, value]) => value.trim() === '');
      expect(empty).toEqual([]);
    });

    it(`${name} uses the same placeholders as ru`, () => {
      const mismatched = Object.keys(reference)
        .filter((key) => key in flat)
        .filter((key) => placeholders(flat[key]).join() !== placeholders(reference[key]).join());
      expect(mismatched).toEqual([]);
    });
  }
});
