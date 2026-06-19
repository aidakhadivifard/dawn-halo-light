// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function patchServerBuildPlugin() {
  return {
    name: "patch-server-build",
    closeBundle() {
      try {
        const src = resolve("dist/server/index.mjs");
        const dst = resolve("dist/server/server.js");
        mkdirSync(resolve("dist/server"), { recursive: true });
        copyFileSync(src, dst);
        let code = readFileSync(dst, "utf-8");
        // Patch augmentReq to not fail when req.ip is read-only (Node.js preview server)
        code = code.replace(
          'req.ip = cfReq.headers.get("cf-connecting-ip") || void 0;',
          'try { req.ip = cfReq.headers.get("cf-connecting-ip") || void 0; } catch {}'
        );
        writeFileSync(dst, code);
      } catch (e) {
        console.error("[patch-server-build] failed:", e);
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
