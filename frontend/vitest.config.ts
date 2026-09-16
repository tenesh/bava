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
  },
});
