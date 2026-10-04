import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { forceStates } from './tests/harness/force-states';

const MEDIA = fileURLToPath(new URL('../testdata/fixtures/media/', import.meta.url));
const TYPES: Record<string, string> = { png: 'image/png', mp4: 'video/mp4' };

/**
 * The app's file route, for the pretend Space: its attachments are
 * testdata/fixtures/media's files. A video is answered and never finished, so it
 * stays on its poster: the container's browser plays no H.264.
 */
function fileRoute(): Plugin {
  return {
    name: 'bava-file-route',
    configureServer(server) {
      server.middlewares.use('/bava-file/', (req, res) => {
        const path = new URL(req.url ?? '', 'http://x').searchParams.get('path') ?? '';
        const name = /^\.bava\/attachments\/([^/]+)$/.exec(path)?.[1];
        const type = TYPES[name?.split('.').pop() ?? ''];
        const video = type === 'video/mp4' && name === 'demo.mp4';
        const file = name ? MEDIA + name : '';
        if (!type || (!video && !existsSync(file))) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', type);
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        if (video) {
          res.writeHead(200);
          return;
        }
        res.end(readFileSync(file));
      });
    },
  };
}

// The browser tests' page: the real interface with the Go bindings pointed at
// the stand-in in tests/harness. Never used by the app's own build.
export default defineConfig({
  plugins: [svelte(), fileRoute()],
  // A sheet can show hovered, focused and pressed side by side.
  css: { postcss: { plugins: [forceStates] } },
  resolve: {
    alias: [
      {
        find: /^.*\/bindings\/github\.com\/tenesh\/bava\/internal\/app$/,
        replacement: fileURLToPath(new URL('./tests/harness/bindings-app.ts', import.meta.url)),
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
