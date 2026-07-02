// Platform detection for the Capacitor native shells.
//
// App Store rule 3.1.1: digital-content subscriptions inside an iOS app must
// use Apple In-App Purchase — offering (or even linking to) Stripe checkout
// there is a rejection. Until IAP is integrated, iOS builds hide the purchase
// UI entirely; the daily card is free forever, so the app stays fully usable.

import { Capacitor } from "@capacitor/core";

export function isIosNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}
