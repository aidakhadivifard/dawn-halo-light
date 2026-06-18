// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // SPA mode emits a static index.html shell that boots the client router with
    // no server. This is what lets the app run fully offline inside the native
    // (Capacitor) app and as a static deploy — see CAP_BUILD below.
    spa: { enabled: true },
  },
  // The SPA prerender step starts a Vite preview server; force it onto IPv4 so it
  // can bind in environments without IPv6 (CI/sandboxes default to `::`).
  vite: {
    preview: { host: "127.0.0.1" },
  },
});
