// "What you're holding on for" — the endurance-goal home. Onboarding is three
// steps (name it → pick a ritual → first check-in, so Day 1 is earned in the
// first minute). The home keeps the day count primary, streak secondary.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  type CheckinResult,
  type CheckinState,
  type GoalStatus,
  type GoalSummary,
  type RitualType,
} from "@/lib/api";
import {
  answerHonesty,
  checkin as postCheckin,
  closeGoal,
  createGoal,
  doRitual,
  getGoalPhoto,
  getGoalStatus,
  setGoalPhoto,
} from "@/lib/goalStore";
import { fromApiCard, type Card } from "@/lib/cards";
import { BottomNav } from "@/components/BottomNav";
import { track } from "@/lib/analytics";
import { shareCardAsImage } from "@/lib/shareImage";
import { artForCard } from "@/lib/dawnhalo";
import {
  ABANDON_CONFIRM,
  BENCHMARK_SOURCE_LABEL,
  CREATION_BEGIN,
  CREATION_CTA,
  CREATION_EDIT,
  CREATION_LATER,
  CREATION_OPENING,
  CREATION_REWARD_HELPER,
  CREATION_SUMMARY_HEAD,
  CREATION_SUMMARY_NOTE,
  CREATION_TITLE_HELPER,
  HONESTY_OPTIONS,
  HONESTY_RESPONSES,
  JOURNAL_LOCKED,
  ONBOARDING,
  RETURNED_TIMES,
  RITUAL_CARD_HEADING,
  RITUAL_WRITING_HEADING,
  RITUAL_WRITING_PLACEHOLDER,
  STATE_OPTIONS,
} from "@/lib/goalCopy";

export const Route = createFileRoute("/goal")({
  head: () => ({
    meta: [
      { title: "What you're holding on for — Dawnhalo" },
      { name: "description", content: "One goal, one honest day at a time." },
    ],
  }),
  component: GoalPage,
});

const RETENTION_DAYS = [1, 3, 7, 30];

// The Witness — one chosen person who sees only the Day number, never the
// goal or anything written. The invite works in a plain browser tab, so the
// witness needs no app; every accepted invite is also the app's first
// in-product growth loop.
function WitnessRow() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const invite = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setCopied(false);
    const { inviteWitness } = await import("@/lib/witness");
    const out = await inviteWitness("goal_page");
    if (out === "failed") setFailed(true);
    if (out === "copied") setCopied(true);
    setBusy(false);
  };

  return (
    <section className="mt-6">
      <div className="p-5 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl">
        <p className="font-serif text-lg">A witness</p>
        <p className="mt-1 text-xs text-dawn-ink/50 leading-relaxed">
          One person you choose sees your day number — nothing else. Not your goal, not your
          words. Just that you are still here, day after day.
        </p>
        <button
          onClick={invite}
          disabled={busy}
          className="mt-3 w-full py-3 text-xs uppercase tracking-[0.2em] font-bold rounded-full border border-dawn-haze/30 text-dawn-ink/70 hover:bg-dawn-haze/10 disabled:opacity-50"
        >
          Choose your witness
        </button>
        {copied && (
          <p className="mt-2 text-center text-xs text-dawn-ink/55">
            Link copied — send it to the one you chose.
          </p>
        )}
        {failed && (
          <p className="mt-2 text-center text-xs text-dawn-rose/90">
            Can't reach Dawnhalo right now — try again in a moment.
          </p>
        )}
      </div>
    </section>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 18 });
  return (
    <>
      <style>{`@keyframes goal-confetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(70vh) rotate(540deg); opacity: 0 } }`}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((_, i) => (
          <span
            key={i}
            className="absolute top-0 block w-1.5 h-3 rounded-sm"
            style={{
              left: `${(i * 53) % 100}%`,
              background: ["#f5cf8a", "#f4a37a", "#bd5c78"][i % 3],
              animation: `goal-confetti ${2.2 + (i % 5) * 0.35}s ease-in ${(i % 7) * 0.18}s both`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-dawn-ink/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-dawn-gold to-dawn-rose transition-all duration-700"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function BenchmarkLineView({
  benchmark,
  onSourceOpen,
}: {
  benchmark: NonNullable<GoalStatus["benchmark"]>;
  onSourceOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-5 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl">
      <p className="text-sm leading-relaxed italic font-serif text-dawn-ink/85">{benchmark.text}</p>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) onSourceOpen?.();
        }}
        className="mt-2 text-[10px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70 border-b border-dawn-haze/20"
      >
        {BENCHMARK_SOURCE_LABEL}
      </button>
      {open && (
        <p className="mt-2 text-xs text-dawn-ink/55 leading-relaxed">
          {benchmark.sourceName} ·{" "}
          <a
            href={benchmark.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dawn-haze/40 break-all"
          >
            {benchmark.sourceUrl}
          </a>
        </p>
      )}
    </div>
  );
}

function GoalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GoalStatus | null>(null);
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState(false);

  useEffect(() => {
    let alive = true;
    // Don't hang on a cold backend (Render free tier): show onboarding/home
    // from what we know, reconcile when the real status arrives.
    const loadingFallback = setTimeout(() => alive && setLoading(false), 2500);
    getGoalStatus().then((s) => {
      if (!alive) return;
      clearTimeout(loadingFallback);
      setStatus(s);
      setLoading(false);
    });
    setPhoto(getGoalPhoto());
    return () => {
      alive = false;
      clearTimeout(loadingFallback);
    };
  }, []);

  const refresh = async () => setStatus(await getGoalStatus());

  if (loading) {
    return (
      <Shell>
        <p className="py-24 text-center text-sm opacity-50">…</p>
      </Shell>
    );
  }

  if (summary) {
    return (
      <Shell>
        <SummaryView summary={summary} photo={photo} onDone={() => setSummary(null)} />
      </Shell>
    );
  }

  if (!status) {
    return (
      <Shell>
        <Onboarding
          onCreated={(s) => {
            setStatus(s);
            setPhoto(getGoalPhoto());
          }}
          onOffline={() => setOfflineNote(true)}
          offlineNote={offlineNote}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <GoalHome
        status={status}
        photo={photo}
        onRefresh={refresh}
        onSummary={(s) => {
          setSummary(s);
          setStatus(null);
        }}
        onCrisis={() => navigate({ to: "/support" })}
        onPaywall={(source) => {
          track("paywall_hit", { source });
          navigate({ to: "/paywall" });
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-dawn-sky text-dawn-ink overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full blur-[120px] opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(245,207,138,0.3) 0%, rgba(244,163,122,0.15) 35%, transparent 70%)",
        }}
      />
      <main className="relative max-w-md mx-auto px-6 pt-12 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------- onboarding

// Flow v2: goal creation is ONE flowing conversation — every question on one
// scroll, no pagination. The first check-in happens on Today, after the card.

const ONBOARD_INPUT =
  "w-full bg-dawn-surface text-dawn-ink placeholder:text-dawn-ink/40 border border-dawn-haze/30 rounded-2xl px-5 py-4 text-base text-center focus:outline-none focus:ring-1 ring-dawn-rose/40";

function Onboarding({
  onCreated,
  onOffline,
  offlineNote,
}: {
  onCreated: (s: GoalStatus) => void;
  onOffline: () => void;
  offlineNote: boolean;
}) {
  const navigate = useNavigate();
  const [intro, setIntro] = useState(true);
  const [review, setReview] = useState(false);
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [ritual, setRitual] = useState<RitualType>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<GoalStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  })();

  const ready = title.trim() && reward.trim() && targetDate;

  const commit = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    const res = await createGoal({ title, reward, targetDate, ritual });
    setBusy(false);
    if (res.kind === "ok") {
      track("goal_created");
      setCreated(res.status);
      return;
    }
    if (res.kind === "offline") {
      onOffline();
      return;
    }
    setError("That didn't take — check the date is in the future.");
  };

  // Day 1 starts at commit; the first check-in happens on Today, after the card.
  if (created) {
    return (
      <section className="py-14 text-center animate-card-rise">
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Day 1</p>
        <h1 className="mt-3 text-3xl font-serif font-light italic leading-snug">
          It's named. It's yours now.
        </h1>
        <p className="mt-4 text-sm text-dawn-ink/60 leading-relaxed max-w-[32ch] mx-auto">
          {created.goal.title}
        </p>
        <button
          onClick={() => {
            onCreated(created);
            void navigate({ to: "/" });
          }}
          className="mt-10 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)]"
        >
          Draw today's card
        </button>
      </section>
    );
  }

  // Gentle opening — a journey is offered, never pushed.
  if (intro) {
    return (
      <section className="flex flex-col items-center text-center py-16 animate-card-rise">
        <div className="relative w-32 h-32 mb-6">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-[50px] opacity-70 animate-halo"
            style={{
              background:
                "radial-gradient(circle, rgba(245,207,138,0.5) 0%, rgba(244,163,122,0.25) 50%, transparent 75%)",
            }}
          />
        </div>
        {CREATION_OPENING.map((l, i) => (
          <p key={i} className="font-serif italic text-xl leading-relaxed text-balance max-w-[28ch]">
            {l}
          </p>
        ))}
        <button
          onClick={() => setIntro(false)}
          className="mt-10 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)]"
        >
          {CREATION_CTA}
        </button>
        <button
          onClick={() => void navigate({ to: "/" })}
          className="mt-4 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70"
        >
          {CREATION_LATER}
        </button>
      </section>
    );
  }

  // Commitment summary — eyes open before Day 1.
  if (review) {
    return (
      <section className="py-10 text-center animate-card-rise">
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">{CREATION_SUMMARY_HEAD}</p>
        <h1 className="mt-4 text-2xl font-serif font-light italic leading-snug text-balance">{title}</h1>
        <p className="mt-2 text-sm text-dawn-ink/60">Until {targetDate}</p>
        <p className="mt-1 text-sm text-dawn-ink/60">For: {reward}</p>
        <div className="mt-8 space-y-1">
          {CREATION_SUMMARY_NOTE.map((l, i) => (
            <p key={i} className="text-sm font-serif italic text-dawn-ink/70 leading-relaxed">
              {l}
            </p>
          ))}
        </div>
        <button
          onClick={commit}
          disabled={busy}
          className="mt-10 w-full py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full disabled:opacity-50"
        >
          {busy ? "Committing…" : CREATION_BEGIN}
        </button>
        <button
          onClick={() => setReview(false)}
          className="mt-3 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70"
        >
          {CREATION_EDIT}
        </button>
        {error && <p className="mt-3 text-xs text-dawn-rose/90">{error}</p>}
        {offlineNote && (
          <p className="mt-3 text-xs text-dawn-rose/90">Can't reach Dawnhalo right now — try again in a moment.</p>
        )}
      </section>
    );
  }

  // One flowing conversation — the next question appears when the current one
  // is answered (progressive disclosure), nothing removed.
  return (
    <section className="flex flex-col items-center text-center py-6 animate-card-rise">
      <div className="relative w-28 h-28 mb-4">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-[46px] opacity-70 animate-halo"
          style={{
            background:
              "radial-gradient(circle, rgba(245,207,138,0.5) 0%, rgba(244,163,122,0.25) 50%, transparent 75%)",
          }}
        />
      </div>

      <div className="w-full max-w-sm space-y-10">
        <div>
          <h1 className="text-2xl font-serif font-light italic text-balance leading-snug">
            {ONBOARDING.titleHeading}
          </h1>
          <p className="mt-2 text-sm text-dawn-ink/55">{CREATION_TITLE_HELPER}</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ONBOARDING.titlePlaceholder}
            className={ONBOARD_INPUT + " mt-4"}
          />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {ONBOARDING.titleExamples.map((ex) => (
              <button
                key={ex}
                onClick={() => setTitle(ex)}
                className={
                  "text-[12px] px-4 py-2 rounded-full border transition-colors " +
                  (title === ex
                    ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                    : "border-dawn-haze/25 text-dawn-ink/75 hover:bg-dawn-haze/10")
                }
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {title.trim() && (
        <div className="animate-card-rise">
          <h2 className="text-xl font-serif font-light italic text-balance leading-snug">
            {ONBOARDING.rewardHeading}
          </h2>
          <p className="mt-2 text-sm text-dawn-ink/55">{CREATION_REWARD_HELPER}</p>
          <input
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            placeholder={ONBOARDING.rewardPlaceholder}
            className={ONBOARD_INPUT + " mt-4"}
          />
        </div>
        )}

        {reward.trim() && (
        <div className="animate-card-rise">
          <h2 className="text-xl font-serif font-light italic text-balance leading-snug">
            {ONBOARDING.dateHeading}
          </h2>
          <p className="mt-2 text-sm text-dawn-ink/55">{ONBOARDING.dateSub}</p>
          <input
            type="date"
            min={minDate}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={ONBOARD_INPUT + " mt-4"}
          />
          <p className="mt-2 text-xs text-dawn-ink/45 leading-relaxed max-w-[34ch] mx-auto">
            {ONBOARDING.dateLockNote}
          </p>
        </div>
        )}

        {targetDate && (
        <div className="animate-card-rise">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhotoPreview(await setGoalPhoto(f));
            }}
          />
          <div className="flex items-center justify-center gap-3">
            {photoPreview && (
              <img
                src={photoPreview}
                alt=""
                className="size-12 rounded-xl object-cover ring-1 ring-dawn-haze/30"
              />
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[12px] px-4 py-2.5 rounded-full border border-dawn-haze/25 text-dawn-ink/75 hover:bg-dawn-haze/10 transition-colors"
            >
              {photoPreview ? "Change photo" : ONBOARDING.photoButton}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-dawn-ink/40">{ONBOARDING.photoPrivacy}</p>
        </div>
        )}

        {targetDate && (
        <div className="animate-card-rise">
          <h2 className="text-xl font-serif font-light italic text-balance leading-snug">
            When the journey feels difficult, how would you rather return to yourself?
          </h2>
          <div className="mt-4 space-y-3">
            {(
              [
                { id: "card", label: ONBOARDING.ritualCard, sub: ONBOARDING.ritualCardSub },
                { id: "writing", label: ONBOARDING.ritualWriting, sub: ONBOARDING.ritualWritingSub },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRitual(opt.id)}
                className={
                  "w-full p-5 rounded-2xl border transition-colors " +
                  (ritual === opt.id
                    ? "bg-dawn-rose/15 border-dawn-rose/40"
                    : "bg-dawn-surface border-dawn-haze/25 hover:bg-dawn-haze/10")
                }
              >
                <p className="font-serif text-xl italic">{opt.label}</p>
                <p className="mt-1 text-xs text-dawn-ink/55">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>
        )}

        {ready && (
        <div className="animate-card-rise">
          <button
            onClick={() => setReview(true)}
            className="w-full py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all"
          >
            Continue
          </button>
        </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- goal home

function GoalHome({
  status,
  photo,
  onRefresh,
  onSummary,
  onCrisis,
  onPaywall,
}: {
  status: GoalStatus;
  photo: string | null;
  onRefresh: () => Promise<void>;
  onSummary: (s: GoalSummary) => void;
  onCrisis: () => void;
  onPaywall: (source: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [honestyOpen, setHonestyOpen] = useState(false);
  const [ritualCard, setRitualCard] = useState<Card | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [writingText, setWritingText] = useState("");
  const [writingOpen, setWritingOpen] = useState(false);
  const [journal, setJournal] = useState<Awaited<ReturnType<typeof import("@/lib/api").api.goalHistory>> | null>(null);
  const [journalLocked, setJournalLocked] = useState(false);
  const [offlineNote, setOfflineNote] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const g = status.goal;
  const checked = status.checkedInToday || !!checkinResult;
  const honestyDue = checkinResult?.honestyDue ?? status.honestyDue;

  const submitCheckin = async (state: CheckinState) => {
    if (busy) return;
    setBusy(true);
    setOfflineNote(false);
    const res = await postCheckin({ state, note: note.trim() || undefined });
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      return;
    }
    if (res.kind === "crisis") {
      onCrisis();
      return;
    }
    const c = res.checkin;
    track("checkin_completed", { state: c.state, day: c.day, already: c.already });
    if (!c.already && RETENTION_DAYS.includes(c.day)) track("dN_retention", { day: c.day });
    setCheckinResult(c);
    setNote("");
    if (c.summary) {
      track("goal_completed", { daysHeld: c.summary.daysHeld });
      onSummary(c.summary);
      return;
    }
    if (c.milestone) setShowMilestone(true);
    void onRefresh();
  };

  const runRitual = async (type: RitualType) => {
    if (busy) return;
    if (type === "writing" && !writingText.trim()) return;
    setBusy(true);
    setOfflineNote(false);
    const res = await doRitual({ type, text: type === "writing" ? writingText : undefined });
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      return;
    }
    if (res.kind === "crisis") {
      onCrisis();
      return;
    }
    if (res.kind === "paywall") {
      onPaywall("goal_ritual");
      return;
    }
    track("ritual_completed", { type });
    if (res.kind === "card") setRitualCard(fromApiCard(res.card));
    else setReflection(res.reflection);
    void onRefresh();
  };

  const answer = async (a: "continue" | "adjust" | "thinking" | "done") => {
    if (busy) return;
    setBusy(true);
    const res = await answerHonesty(a);
    setBusy(false);
    if (res.kind === "offline") {
      setOfflineNote(true);
      return;
    }
    track("honesty_check_answered", { answer: a });
    setHonestyOpen(false);
    if (a === "done" && res.summary) {
      track("goal_abandoned", { daysHeld: res.summary.daysHeld });
      onSummary(res.summary);
      return;
    }
    void onRefresh();
  };

  const openJournal = async () => {
    try {
      const { api } = await import("@/lib/api");
      setJournal(await api.goalHistory());
      setJournalLocked(false);
    } catch {
      setJournalLocked(true);
    }
  };

  const shareMilestone = async (message: string) => {
    const pseudo: Card = {
      id: `milestone_${status.day}`,
      opener: "",
      title: `Day ${status.day}`,
      message,
      illustration: photo ?? artForCard({ id: g.id, theme: "quiet_strength" }),
    };
    await shareCardAsImage(pseudo);
    track("card_image_shared", { source: "milestone" });
  };

  const gentle = (checkinResult?.state ?? status.todayState) === "cant";
  const benchmark = checkinResult ? checkinResult.benchmark : gentle ? null : status.benchmark;

  return (
    <>
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 mb-1">
          What you're holding on for
        </p>
        <div className="flex items-center gap-4">
          {photo && (
            <img src={photo} alt="" className="size-14 rounded-xl object-cover ring-1 ring-dawn-haze/20" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-serif font-light italic truncate">{g.title}</h1>
            <p className="text-xs text-dawn-ink/50 truncate">{g.reward}</p>
          </div>
        </div>
      </header>

      <section className="text-center py-6">
        <span className="block text-7xl font-serif italic text-dawn-haze leading-none">
          {status.day}
        </span>
        <span className="mt-2 block text-[10px] uppercase tracking-[0.25em] opacity-45">
          days since commitment
        </span>
        <p className="mt-1 text-[11px] text-dawn-ink/40">
          streak {status.streak} · {Math.max(0, status.totalDays - status.day)} days to {g.targetDate}
        </p>
        {(status.checkinCount ?? 0) > 0 && (
          <p className="mt-1 text-[11px] text-dawn-ink/45 font-serif italic">
            {RETURNED_TIMES(status.checkinCount)}
          </p>
        )}
        <div className="mt-5">
          <ProgressBar value={status.progress} />
        </div>
      </section>

      {/* Honesty check comes BEFORE the ritual when due */}
      {honestyDue && !honestyOpen && checked && (
        <button
          onClick={() => setHonestyOpen(true)}
          className="w-full mb-6 p-5 text-left bg-dawn-rose/10 border border-dawn-rose/30 rounded-2xl"
        >
          <p className="font-serif text-lg">{status.honestyPrompt}</p>
          <p className="mt-1 text-xs text-dawn-ink/50">Take a minute. Answer honestly.</p>
        </button>
      )}

      {honestyOpen && (
        <section className="mb-6 p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl space-y-3 animate-card-rise">
          <p className="font-serif text-lg leading-snug">{status.honestyPrompt}</p>
          {HONESTY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => answer(opt.id)}
              disabled={busy}
              className="w-full p-4 text-left text-sm rounded-xl border border-dawn-haze/20 hover:bg-dawn-haze/10 disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </section>
      )}

      {/* Today's check-in */}
      {!checked ? (
        <section className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 ml-1">
            How are you holding up today?
          </p>
          {STATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => submitCheckin(opt.id)}
              disabled={busy}
              className="w-full p-4 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
            >
              <p className="font-serif text-base">{opt.label}</p>
            </button>
          ))}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line about today (optional)"
            className="w-full bg-dawn-surface/70 border border-dawn-haze/15 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-1 ring-dawn-rose/30 placeholder:text-dawn-ink/30"
          />
        </section>
      ) : (
        <section className="space-y-4">
          {checkinResult && (
            <div className="p-5 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
              <p className="font-serif text-lg italic leading-snug">{checkinResult.ack}</p>
              {checkinResult.honestyOffer && (
                <button
                  onClick={() => setHonestyOpen(true)}
                  className="mt-3 text-xs text-dawn-ink/55 underline decoration-dawn-haze/40 text-left"
                >
                  {checkinResult.honestyOffer}
                </button>
              )}
            </div>
          )}

          {benchmark && (
            <BenchmarkLineView
              benchmark={benchmark}
              onSourceOpen={() => track("benchmark_viewed", { id: benchmark.id })}
            />
          )}

          {/* Ritual */}
          {!status.ritualDoneToday && !ritualCard && !reflection && (
            <div className="p-5 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-3">
                {gentle || (checkinResult?.suggestedRitual ?? g.ritual) === "writing"
                  ? RITUAL_WRITING_HEADING
                  : RITUAL_CARD_HEADING}
              </p>
              {(gentle || (checkinResult?.suggestedRitual ?? g.ritual) === "writing" || writingOpen) ? (
                <div>
                  <textarea
                    value={writingText}
                    onChange={(e) => setWritingText(e.target.value)}
                    rows={3}
                    placeholder={RITUAL_WRITING_PLACEHOLDER}
                    className="w-full bg-dawn-night/5 border border-dawn-haze/15 rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-dawn-rose/30 resize-none placeholder:text-dawn-ink/30"
                  />
                  <button
                    onClick={() => runRitual("writing")}
                    disabled={busy || !writingText.trim()}
                    className="mt-3 w-full py-3.5 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-xs uppercase tracking-[0.2em] font-bold rounded-full disabled:opacity-40"
                  >
                    Reflect
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => runRitual("card")}
                    disabled={busy}
                    className="w-full py-3.5 bg-dawn-rose/15 border border-dawn-rose/30 text-dawn-rose text-xs uppercase tracking-[0.2em] font-bold rounded-full disabled:opacity-50"
                  >
                    Pull today's card
                  </button>
                  <button
                    onClick={() => setWritingOpen(true)}
                    className="w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70"
                  >
                    Write instead
                  </button>
                </div>
              )}
            </div>
          )}

          {ritualCard && (
            <article className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
              <div className="w-full aspect-[4/5] mb-5 rounded-lg overflow-hidden ring-1 ring-dawn-haze/15 bg-black/30">
                <img src={ritualCard.illustration} alt={ritualCard.title} className="h-full w-full object-cover" />
              </div>
              {ritualCard.opener && (
                <p className="text-sm italic font-serif text-dawn-ink/60 mb-2">{ritualCard.opener}</p>
              )}
              <h2 className="text-2xl font-serif font-light">{ritualCard.title}</h2>
              <div className="mt-3 space-y-3">
                {ritualCard.message.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-dawn-ink/85">{p}</p>
                ))}
              </div>
              {ritualCard.reflection && (
                <p className="mt-4 text-sm italic font-serif text-dawn-ink/60">{ritualCard.reflection}</p>
              )}
            </article>
          )}

          {reflection && (
            <div className="p-6 bg-dawn-surface/80 border border-dawn-haze/15 rounded-2xl animate-card-rise">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-2">Reflection</p>
              <p className="font-serif italic text-lg leading-relaxed">{reflection}</p>
            </div>
          )}
        </section>
      )}

      {offlineNote && (
        <p className="mt-4 text-center text-xs text-dawn-rose/90">
          Can't reach Dawnhalo right now — your day count is safe; try again in a moment.
        </p>
      )}

      {/* Journal (premium) */}
      <section className="mt-10">
        {!journal && !journalLocked && (
          <button
            onClick={openJournal}
            className="w-full p-5 text-left bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl hover:bg-dawn-haze/10"
          >
            <p className="font-serif text-lg">Journal</p>
            <p className="text-xs text-dawn-ink/50">Every check-in, everything you wrote.</p>
          </button>
        )}
        {journalLocked && (
          <Link to="/paywall" className="block p-5 bg-dawn-surface/60 border border-dawn-haze/15 rounded-2xl">
            <p className="font-serif text-lg">Journal</p>
            <p className="text-xs text-dawn-ink/50">{JOURNAL_LOCKED}</p>
          </Link>
        )}
        {journal && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 ml-1">Journal</p>
            {[...journal.checkins].reverse().map((c) => {
              const entry = journal.entries.find((e) => e.date === c.date);
              const label = STATE_OPTIONS.find((s) => s.id === c.state)?.label ?? c.state;
              return (
                <div key={c.id} className="p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl">
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-40">{c.date}</p>
                  <p className="mt-1 text-sm font-serif">{label}</p>
                  {c.note && <p className="mt-1 text-sm text-dawn-ink/70 italic">“{c.note}”</p>}
                  {entry?.userText && (
                    <p className="mt-2 text-sm text-dawn-ink/70 italic">“{entry.userText}”</p>
                  )}
                  {entry?.aiReflection && (
                    <p className="mt-1 text-xs text-dawn-ink/50">{entry.aiReflection}</p>
                  )}
                </div>
              );
            })}
            {journal.honesty.length > 0 && (
              <>
                <p className="pt-2 text-[10px] uppercase tracking-[0.2em] opacity-50 ml-1">
                  Honesty checks
                </p>
                {[...journal.honesty].reverse().map((h) => (
                  <div key={h.id} className="p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl">
                    <p className="text-[10px] uppercase tracking-[0.18em] opacity-40">
                      Day {h.day} · {h.date}
                    </p>
                    <p className="mt-1 text-sm font-serif">
                      {HONESTY_OPTIONS.find((o) => o.id === h.answer)?.label ?? h.answer}
                    </p>
                    {h.note && <p className="mt-1 text-sm text-dawn-ink/70 italic">“{h.note}”</p>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* The Witness — one chosen person sees the day number, nothing else */}
      <WitnessRow />

      {/* Quiet close ("I'm done" outside the honesty rhythm) */}
      <section className="mt-10 text-center">
        {!confirmClose ? (
          <button
            onClick={() => setConfirmClose(true)}
            className="text-[11px] uppercase tracking-[0.18em] text-dawn-ink/35 hover:text-dawn-ink/60"
          >
            Close this goal
          </button>
        ) : (
          <div className="p-5 bg-dawn-surface/70 border border-dawn-haze/15 rounded-2xl text-left">
            <p className="text-sm leading-relaxed text-dawn-ink/75">{ABANDON_CONFIRM}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={async () => {
                  const res = await closeGoal("abandoned");
                  if (res.kind === "ok") {
                    track("goal_abandoned", { daysHeld: res.summary.daysHeld });
                    onSummary(res.summary);
                  } else setOfflineNote(true);
                }}
                className="flex-1 py-3 text-xs uppercase tracking-[0.18em] font-bold rounded-full border border-dawn-rose/40 text-dawn-rose"
              >
                Close it
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="flex-1 py-3 text-xs uppercase tracking-[0.18em] rounded-full border border-dawn-haze/20 text-dawn-ink/60"
              >
                Keep going
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Milestone overlay */}
      {showMilestone && checkinResult?.milestone && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-dawn-ink/40 backdrop-blur-sm px-6">
          <Confetti />
          <div className="relative w-full max-w-sm p-8 bg-dawn-sky rounded-3xl border border-dawn-haze/20 text-center animate-card-rise">
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-50">Milestone</p>
            <p className="mt-4 text-2xl font-serif font-light italic leading-snug">
              {checkinResult.milestone.message}
            </p>
            <button
              onClick={() => shareMilestone(checkinResult.milestone!.message)}
              className="mt-8 w-full py-3.5 bg-dawn-rose text-dawn-sky text-xs uppercase tracking-[0.2em] font-bold rounded-full"
            >
              Share this day
            </button>
            <button
              onClick={() => setShowMilestone(false)}
              className="mt-3 w-full py-2 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40"
            >
              Keep it for myself
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- summary

function SummaryView({
  summary,
  photo,
  onDone,
}: {
  summary: GoalSummary;
  photo: string | null;
  onDone: () => void;
}) {
  return (
    <section className="py-10 text-center animate-card-rise">
      {summary.outcome === "completed" && (
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <Confetti />
        </div>
      )}
      {photo && (
        <img src={photo} alt="" className="mx-auto size-20 rounded-2xl object-cover ring-1 ring-dawn-haze/20 mb-6" />
      )}
      <p className="text-[10px] uppercase tracking-[0.25em] opacity-50">
        {summary.startDate} → {summary.endDate}
      </p>
      <h1 className="mt-4 text-3xl font-serif font-light italic leading-snug">{summary.heading}</h1>
      <p className="mt-3 text-sm text-dawn-ink/60">{summary.title}</p>
      <div className="mt-8 grid grid-cols-2 gap-3 text-left">
        <div className="p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl">
          <p className="text-2xl font-serif italic text-dawn-haze">{summary.daysHeld}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] opacity-45">days held</p>
        </div>
        <div className="p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl">
          <p className="text-2xl font-serif italic text-dawn-haze">{summary.checkinCount}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] opacity-45">check-ins</p>
        </div>
      </div>
      {summary.notes.length > 0 && (
        <div className="mt-6 space-y-2 text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 ml-1">Along the way, you wrote</p>
          {summary.notes.slice(0, 6).map((n, i) => (
            <p key={i} className="p-4 bg-dawn-surface/60 border border-dawn-haze/15 rounded-xl text-sm italic font-serif text-dawn-ink/75">
              “{n}”
            </p>
          ))}
        </div>
      )}
      <Link
        to="/goal"
        onClick={onDone}
        className="inline-block mt-10 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full"
      >
        Name what's next
      </Link>
      <p className="mt-4">
        <Link to="/" className="text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40">
          Back to today's card
        </Link>
      </p>
    </section>
  );
}
