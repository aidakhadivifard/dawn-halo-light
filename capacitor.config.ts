/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from "@capacitor/cli";

// Dawnhalo native shell config (Android + iOS via Capacitor).
//
// Because the web app is server-rendered (TanStack Start), the native apps load
// the DEPLOYED site inside the native shell and add native value on top (push
// reminders, etc.). Set CAP_SERVER_URL to your deployed frontend URL before
// `npx cap sync`. When unset, the shell shows the local loading/offline screen
// in `mobile-shell/`.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.dawnhalo.app",
  appName: "Dawnhalo",
  // A minimal local shell (loading + offline screen). The real UI comes from
  // server.url when configured.
  webDir: "mobile-shell",
  ...(serverUrl
    ? { server: { url: serverUrl, cleartext: false } }
    : {}),
  backgroundColor: "#fdfcfb",
  ios: { contentInset: "always" },
  android: { backgroundColor: "#fdfcfb" },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#fdfcfb",
      showSpinner: false,
    },
  },
};

export default config;
