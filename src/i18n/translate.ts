/**
 * Pure, framework-agnostic translation lookup.
 *
 * Resolves a dot-separated `key` against a (possibly nested) message dictionary
 * and optionally interpolates `{name}` placeholders from `vars`. Kept free of
 * Svelte/DOM so it is trivially unit-testable.
 */

export type Dict = { [key: string]: string | Dict };

export type TranslateVars = Record<string, string | number>;

/** Look up `key` in `dict`; returns `undefined` if the path is missing or not a string. */
function resolve(dict: Dict, key: string): string | undefined {
  let current: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/** Replace `{name}` placeholders with values from `vars`, leaving unknown ones intact. */
function interpolate(template: string, vars: TranslateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Translate `key` using `dict`. If the key is missing, the key itself is returned
 * so a missing string is visible (and searchable) rather than silently blank.
 */
export function translate(dict: Dict, key: string, vars?: TranslateVars): string {
  const value = resolve(dict, key);
  if (value === undefined) return key;
  return vars ? interpolate(value, vars) : value;
}
