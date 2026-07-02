// Daily reminder via Capacitor Local Notifications — the retention loop for a
// daily-ritual app. Native-only (Android/iOS shells); on the web this module
// no-ops so the Settings UI can still save the preference.
//
// The schedule is (re)synced from two places:
//   - Settings: whenever the user toggles reminders or changes the time.
//   - App boot (__root.tsx): so the schedule survives reinstalls/OS cleanups.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Settings } from "@/lib/dawnhalo";
import { track } from "@/lib/analytics";

const REMINDER_ID = 1001;

// Warm, non-pushy copy. One is picked at scheduling time, so it rotates
// whenever the user revisits the app or changes settings.
const REMINDER_LINES = [
  "Your card for today is waiting.",
  "A little light for your next step is here.",
  "One quiet moment before the day begins?",
  "The deck is shuffled. Come see what today holds.",
];

export function reminderSupported(): boolean {
  try {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Align the scheduled daily notification with the user's settings.
 * Returns "scheduled", "cancelled", "denied", or "unsupported".
 *
 * `prompt` controls whether the OS permission dialog may be shown. Only the
 * Settings toggle passes true — a cold permission prompt at app open both
 * converts terribly and draws App Store review flak.
 */
export async function syncDailyReminder(
  s: Pick<Settings, "reminderTime" | "notificationsOn">,
  { prompt = false }: { prompt?: boolean } = {},
): Promise<"scheduled" | "cancelled" | "denied" | "unsupported"> {
  if (!reminderSupported()) return "unsupported";
  try {
    if (!s.notificationsOn) {
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
      return "cancelled";
    }

    let perm = await LocalNotifications.checkPermissions();
    if (prompt && (perm.display === "prompt" || perm.display === "prompt-with-rationale")) {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== "granted") {
      if (perm.display === "denied") track("reminder_permission_denied");
      return "denied";
    }

    const [hour, minute] = s.reminderTime.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hour) || Number.isNaN(minute)) return "cancelled";

    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: "Dawnhalo",
          body: REMINDER_LINES[Math.floor(Math.random() * REMINDER_LINES.length)],
          // `on` with hour+minute repeats every day at that local time.
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    });
    track("reminder_scheduled");
    return "scheduled";
  } catch {
    // Never let a notification failure break settings or boot.
    return "unsupported";
  }
}
