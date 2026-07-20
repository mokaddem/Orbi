// UTF-8-safe base64url string codec — shared by the async-duel code (`duel.ts`) and the Grandmaster
// invite code (`grandmaster-invite.ts`). Both pack a compact JSON payload into a URL fragment, so
// they need the same accent-safe, `+`/`/`/`=`-free encoding. Pure and framework-agnostic.

/** UTF-8-safe base64url of a string (handles accented names/regions). */
export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverse of {@link toBase64Url}; throws on invalid input (callers catch and report a typed error). */
export function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
