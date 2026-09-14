/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from "@capacitor/cli";

// Dawnhalo native app config (Android + iOS via Capacitor).
//
// DEFAULT (self-contained): the app bundles the built SPA (`dist/cap`, produced
// by `bun run cap:web`) and runs entirely on the device — no server required,
// works offline. This is what `.github/workflows/android.yml` builds into an
// installable .apk.
//
// OPTIONAL (load a deployed site): set CAP_SERVER_URL to make the native shell
// load your deployed frontend instead of the bundled copy.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.dawnhalo.app",
  appName: "Dawnhalo",
  // The bundled SPA build. Populated by `bun run cap:web` (copies dist/client
  // and renames the SPA shell to index.html).
  webDir: "dist/cap",
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
  backgroundColor: "#FFFFFF",
  ios: { contentInset: "always" },
  android: { backgroundColor: "#FFFFFF" },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
  },
};

export default config;
