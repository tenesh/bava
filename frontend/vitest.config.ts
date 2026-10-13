import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { iconSets } from './tooling/icon-sets.ts';

// The Svelte plugin is what compiles runes in `*.svelte.ts` modules, so shared
// state in `.svelte.ts` modules is testable at all. Default environment
// is node; files needing a DOM opt in with `@vitest-environment jsdom`.
export default defineConfig({
  plugins: [svelte(), iconSets()],
  // Without this, Svelte resolves to its server build and `mount` throws
  // `lifecycle_function_unavailable` even under jsdom.
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'node',
    // The design system's generators live beside the app, in `designs/`.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'tooling/**/*.test.ts', '../designs/**/*.test.ts'],
    // Konva needs a 2D context, which jsdom does not implement. A pure-JS mock
    // rather than the native `canvas` package: this has to build on three CI
    // platforms, and a native module there is a maintenance bill for nothing:
    // the tests assert scene patching, not pixels.
    setupFiles: ['vitest-canvas-mock', './src/test-setup.ts'],
    // Spies and stubbed globals put things back after every test, so no test
    // inherits another's.
    restoreMocks: true,
    unstubGlobals: true,
  },
});
