import { describe, it, expect } from 'vitest';
import en from './messages/en';
import fr from './messages/fr';
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
const flatFr = flatten(fr as Dict);

describe('message catalogs (EN/FR parity)', () => {
  it('define exactly the same set of keys', () => {
    expect(Object.keys(flatFr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(value.trim(), `empty EN string for "${key}"`).not.toBe('');
    }
    for (const [key, value] of Object.entries(flatFr)) {
      expect(value.trim(), `empty FR string for "${key}"`).not.toBe('');
    }
  });

  it('use the same interpolation placeholders per key', () => {
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatFr[key]), `placeholder mismatch for "${key}"`).toEqual(
        placeholders(flatEn[key]),
      );
    }
  });
});
