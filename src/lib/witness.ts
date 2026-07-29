// The Witness — shared client seam for the invite and the heavy-day signal.
// One chosen person sees only the Day number; the signal adds one dated flag
// ("today is heavy") with no words and no reply expected.

import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

export type InviteOutcome = "shared" | "copied" | "failed";

const INVITE_TEXT = (url: string) =>
  `Day by day, I'm holding on for something. I chose you to see it: ${url}`;

/** Create (or reuse) the invite and hand it to the share sheet / clipboard. */
export async function inviteWitness(source: string): Promise<InviteOutcome> {
  let url: string;
  try {
    ({ url } = await api.createWitnessInvite());
    track("witness_invite_created", { source });
  } catch {
    return "failed";
  }
  try {
    if (navigator.share) {
      await navigator.share({ text: INVITE_TEXT(url) });
      track("witness_invite_shared", { source });
      return "shared";
    }
  } catch {
    /* share sheet dismissed — the invite exists; offer the copy path */
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Mark today as heavy on the witness page. Returns false when unreachable. */
export async function sendWitnessSignal(source: string): Promise<boolean> {
  let url: string | undefined;
  try {
    ({ url } = await api.sendWitnessSignal());
    track("witness_signal_sent", { source });
  } catch {
    return false;
  }
  // v1 has no push: delivery is the holder's one extra tap. The message stays
  // wordless — a candle and the page — so asking costs nothing in shame.
  try {
    if (url && navigator.share) await navigator.share({ text: `🕯 ${url}` });
  } catch {
    /* share sheet dismissed — the page is updated either way */
  }
  return true;
}
