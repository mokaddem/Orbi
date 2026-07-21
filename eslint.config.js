import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default ts.config(
  {
    // `.claude/` holds agent scratch and (locked) git worktrees — nested repo copies with their
    // own tsconfig. Linting into them makes typescript-eslint's project service see multiple
    // candidate roots and fail to parse; never lint them.
    // `server/` is PocketBase infrastructure, not app code: gitignored generated data
    // (pb_data/types.d.ts is 24k lines) + the downloaded binary + JS migrations that run
    // in PocketBase's own runtime (globals like `migrate`/`Collection`/`Record`). It has
    // its own lifecycle and is not part of the SPA's lint domain.
    ignores: [
      'dist/',
      'dev-dist/',
      'node_modules/',
      '.svelte-kit/',
      'coverage/',
      '.claude/',
      'server/',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      // `__APP_VERSION__` is injected by Vite `define` (see vite.config.ts) from package.json.
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        // Pin the project-service root to this config's directory, so a nested worktree copy
        // can't make the root ambiguous (see the `.claude/` ignore above).
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
);
