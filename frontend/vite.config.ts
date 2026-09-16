import { defineConfig, searchForWorkspaceRoot } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import wails from "@wailsio/runtime/plugins/vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
    fs: {
      // The menu spec lives with the Go that builds the native menu; the
      // shortcuts dialog reads the same file rather than a copy that can drift.
      allow: [searchForWorkspaceRoot(process.cwd()), "../internal/app/menu"],
    },
  },
  plugins: [svelte(), wails("./bindings")],
});
