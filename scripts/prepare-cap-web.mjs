// Prepares the self-contained web bundle that Capacitor ships inside the native
// app. TanStack Start's SPA build emits the entry as `_shell.html`; native
// WebViews expect `index.html` at the web root. This copies dist/client ->
// dist/cap and renames the shell.
//
// Run after `bun run build`:  node scripts/prepare-cap-web.mjs
import { cp, rename, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "dist/client");
const out = resolve(root, "dist/cap");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(src))) {
  console.error(
    `[cap:web] Missing ${src}. Run \`bun run build\` first (it must produce the SPA client build).`,
  );
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await cp(src, out, { recursive: true });

const shell = resolve(out, "_shell.html");
const index = resolve(out, "index.html");
if (await exists(shell)) {
  await rename(shell, index);
} else if (!(await exists(index))) {
  console.error(
    `[cap:web] No _shell.html or index.html in the build. Is SPA mode enabled in vite.config.ts?`,
  );
  process.exit(1);
}

console.log(`[cap:web] Bundled web app ready at dist/cap (entry: index.html).`);
