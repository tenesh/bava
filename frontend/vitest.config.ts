import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The Svelte plugin is what compiles runes in `*.svelte.ts` modules, so shared
// state written per .ai/rules/svelte.md is testable at all. Default environment
// is node; files needing a DOM opt in with `@vitest-environment jsdom`.
export default defineConfig({
  plugins: [svelte()],
  // Without this, Svelte resolves to its server build and `mount` throws
  // `lifecycle_function_unavailable` even under jsdom.
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Konva needs a 2D context, which jsdom does not implement. A pure-JS mock
    // rather than the native `canvas` package: this has to build on three CI
    // platforms, and a native module there is a maintenance bill for nothing —
    // the tests assert scene patching, not pixels.
    setupFiles: ['vitest-canvas-mock'],
  },
});
