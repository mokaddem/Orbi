/// <reference types="svelte" />
/// <reference types="vite/client" />

/** App version injected by Vite `define` from package.json (e.g. "2.3.0"). */
declare const __APP_VERSION__: string;

/**
 * Build-time environment variables (Vite `import.meta.env`). Only `VITE_*` names
 * are exposed to client code. See `.env.example` and `src/backend/client.ts`.
 */
interface ImportMetaEnv {
  /** Base URL of the optional PocketBase backend (Phase 50). Unset = backend off. */
  readonly VITE_PB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
