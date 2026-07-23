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
    // `manual/` is a self-contained sub-project of hand-tuning Playwright labs (its own
    // package.json + tsconfig, not part of the Vitest suite); it isn't shipped code, so keep it
    // out of the app's lint gate.
    ignores: [
      'dist/',
      'dev-dist/',
      'node_modules/',
      '.svelte-kit/',
      'coverage/',
      '.claude/',
      'manual/',
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
