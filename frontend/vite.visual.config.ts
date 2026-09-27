import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// The screen checks' page: the real interface with the Go bindings pointed at
// the stand-in in tests/visual/harness. Never used by the app's own build.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: /^.*\/bindings\/github\.com\/tenesh\/bava\/internal\/app$/,
        replacement: fileURLToPath(new URL('./tests/visual/harness/bindings-app.ts', import.meta.url)),
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 9300,
    strictPort: true,
    fs: { allow: ['.', '../internal/app/menu'] },
  },
});
