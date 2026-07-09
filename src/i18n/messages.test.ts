import { describe, it, expect } from 'vitest';
import en from './messages/en';
import fr from './messages/fr';
import de from './messages/de';
import type { Dict } from './translate';

/** Flatten a (possibly nested) message dict into `dotted.key -> string` entries. */
function flatten(dict: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

/** `{name}`-style placeholder tokens in a template, sorted for order-insensitive compare. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

const flatEn = flatten(en as Dict);

// Every non-English catalog is validated against the English source, which is the
// single point of truth for the key set and placeholder tokens.
const others: Record<string, Record<string, string>> = {
  fr: flatten(fr as Dict),
  de: flatten(de as Dict),
};

describe('message catalogs (EN/FR/DE parity)', () => {
  it('EN itself has no empty strings', () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(value.trim(), `empty EN string for "${key}"`).not.toBe('');
    }
  });

  for (const [lang, flat] of Object.entries(others)) {
    describe(`${lang} vs en`, () => {
      it('defines exactly the same set of keys', () => {
        expect(Object.keys(flat).sort()).toEqual(Object.keys(flatEn).sort());
      });

      it('has no empty strings', () => {
        for (const [key, value] of Object.entries(flat)) {
          expect(value.trim(), `empty ${lang} string for "${key}"`).not.toBe('');
        }
      });

      it('uses the same interpolation placeholders per key', () => {
        for (const key of Object.keys(flatEn)) {
          expect(placeholders(flat[key]), `placeholder mismatch for "${lang}.${key}"`).toEqual(
            placeholders(flatEn[key]),
          );
        }
      });
    });
  }
});
