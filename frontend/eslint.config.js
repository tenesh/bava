// ESLint flat config. Named by the tool, so it is the one permitted `.js`
// file alongside `svelte.config.js` — all source stays TypeScript.
import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
  // Generated or built output. `bindings/` is emitted by Wails.
  { ignores: ['dist/', 'bindings/', 'node_modules/'] },

  js.configs.recommended,
  tseslint.configs.recommended,
  svelte.configs['flat/recommended'],

  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Positional parameters a signature forces on us — a Svelte snippet's
      // `failed(error, reset)` needs only `reset` — are marked with `_`.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Svelte 5: runes files (`.svelte`, `.svelte.ts`) parse through
  // svelte-eslint-parser, with typescript-eslint handling `lang="ts"`.
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig,
      },
    },
  },

  // Build and tooling config run in Node, not the webview.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
