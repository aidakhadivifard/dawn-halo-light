// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

function copyServerBuildPlugin() {
  return {
    name: "copy-server-build",
    closeBundle() {
      try {
        const src = resolve("dist/server/index.mjs");
        const dst = resolve("dist/server/server.js");
        mkdirSync(resolve("dist/server"), { recursive: true });
        copyFileSync(src, dst);
      } catch {
        /* nitro may not have run */
      }
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true },
  },
  vite: {
    preview: { host: "127.0.0.1" },
    plugins: [copyServerBuildPlugin()],
  },
});
