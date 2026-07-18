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
  HONESTY_OPTIONS,
  JOURNAL_LOCKED,
  ONBOARDING,
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
          onCreated={(s, firstCheckin) => {
            setStatus(s);
            setPhoto(getGoalPhoto());
            if (firstCheckin) void refresh();
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

type OnboardStep = "title" | "reward" | "date" | "ritual" | "checkin";
const ONBOARD_STEPS: OnboardStep[] = ["title", "reward", "date", "ritual", "checkin"];

/** One question per screen — a ritual, not a form. Mirrors the Today arrival. */
function OnboardScreen({
  step,
  heading,
  sub,
  children,
  onBack,
}: {
  step: OnboardStep;
  heading: string;
  sub?: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const index = ONBOARD_STEPS.indexOf(step);
  return (
    <section className="flex flex-col items-center text-center py-8 animate-card-rise">
      <div className="relative w-32 h-32 mb-2">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-[50px] opacity-70 animate-halo"
          style={{
            background:
              "radial-gradient(circle, rgba(245,207,138,0.5) 0%, rgba(244,163,122,0.25) 50%, transparent 75%)",
          }}
        />
      </div>
      <div className="flex gap-1.5 mb-6" aria-hidden>
        {ONBOARD_STEPS.map((s, i) => (
          <span
            key={s}
            className={
              "size-1.5 rounded-full transition-colors " +
              (i <= index ? "bg-dawn-haze shadow-[0_0_10px_rgba(245,183,138,0.7)]" : "bg-dawn-ink/20")
            }
          />
        ))}
      </div>
      <h1 className="text-2xl sm:text-3xl font-serif font-light tracking-tight italic text-balance leading-snug">
        {heading}
      </h1>
      {sub && (
        <p className="mt-3 text-sm text-dawn-ink/60 leading-relaxed max-w-[30ch]">{sub}</p>
      )}
      <div className="mt-7 w-full max-w-sm">{children}</div>
      {onBack && (
        <button
          onClick={onBack}
          className="mt-6 text-[11px] uppercase tracking-[0.18em] text-dawn-ink/40 hover:text-dawn-ink/70 transition-colors"
        >
          ← Back
        </button>
      )}
    </section>
  );
}

const ONBOARD_INPUT =
  "w-full bg-dawn-surface text-dawn-ink placeholder:text-dawn-ink/40 border border-dawn-haze/30 rounded-2xl px-5 py-4 text-base text-center focus:outline-none focus:ring-1 ring-dawn-rose/40";
const ONBOARD_CTA =
  "mt-6 w-full py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full shadow-[0_12px_40px_-12px_rgba(244,163,122,0.5)] hover:bg-dawn-haze transition-all disabled:opacity-40";

function Onboarding({
  onCreated,
  onOffline,
  offlineNote,
}: {
  onCreated: (s: GoalStatus, firstCheckin: boolean) => void;
  onOffline: () => void;
  offlineNote: boolean;
}) {
  const [step, setStep] = useState<OnboardStep>("title");
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [ritual, setRitual] = useState<RitualType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<GoalStatus | null>(null);
  const [ack, setAck] = useState<CheckinResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  })();

  const commit = async (chosen: RitualType) => {
    if (busy) return;
    setRitual(chosen);
    setBusy(true);
    setError("");
    const res = await createGoal({ title, reward, targetDate, ritual: chosen });
    setBusy(false);
    if (res.kind === "ok") {
      track("goal_created");
      setCreated(res.status);
      setStep("checkin");
      return;
    }
    if (res.kind === "offline") {
      onOffline();
      return;
    }
    setError("That didn't take — check the date is in the future.");
  };

  const firstCheckin = async (state: CheckinState) => {
    if (busy) return;
    setBusy(true);
    const res = await postCheckin({ state });
    setBusy(false);
    if (res.kind === "checkin") {
      track("checkin_completed", { state, day: res.checkin.day });
      if (RETENTION_DAYS.includes(res.checkin.day))
        track("dN_retention", { day: res.checkin.day });
      setAck(res.checkin);
    }
  };

  if (ack && created) {
    return (
      <section className="py-10 text-center animate-card-rise">
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Day 1</p>
        <h1 className="mt-3 text-3xl font-serif font-light italic">{ack.ack}</h1>
        <p className="mt-4 text-sm text-dawn-ink/60 leading-relaxed max-w-[32ch] mx-auto">
          {created.goal.title}
        </p>
        <button
          onClick={() => onCreated(created, true)}
          className="mt-10 px-10 py-4 bg-dawn-rose text-dawn-sky text-sm uppercase tracking-[0.2em] font-bold rounded-full"
        >
          Begin
        </button>
      </section>
    );
  }

  if (step === "title") {
    return (
      <OnboardScreen step="title" heading={ONBOARDING.titleHeading} sub={ONBOARDING.titleSub}>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={ONBOARDING.titlePlaceholder}
          className={ONBOARD_INPUT}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {ONBOARDING.titleExamples.map((ex) => (
            <button
              key={ex}
              onClick={() => setTitle(ex)}
              className={
                "text-[12px] px-4 py-2.5 rounded-full border transition-colors " +
                (title === ex
                  ? "bg-dawn-rose/15 border-dawn-rose/40 text-dawn-ink"
                  : "border-dawn-haze/25 text-dawn-ink/75 hover:bg-dawn-haze/10")
              }
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          onClick={() => title.trim() && setStep("reward")}
          disabled={!title.trim()}
          className={ONBOARD_CTA}
        >
          Continue
        </button>
      </OnboardScreen>
    );
  }

  if (step === "reward") {
    return (
      <OnboardScreen
        step="reward"
        heading={ONBOARDING.rewardHeading}
        sub={ONBOARDING.rewardSub}
        onBack={() => setStep("title")}
      >
        <input
          autoFocus
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          placeholder={ONBOARDING.rewardPlaceholder}
          className={ONBOARD_INPUT}
        />
        <button
          onClick={() => reward.trim() && setStep("date")}
          disabled={!reward.trim()}
          className={ONBOARD_CTA}
        >
          Continue
        </button>
      </OnboardScreen>
    );
  }

  if (step === "date") {
    return (
      <OnboardScreen
        step="date"
        heading={ONBOARDING.dateHeading}
        sub={ONBOARDING.dateSub}
        onBack={() => setStep("reward")}
      >
        <input
          type="date"
          min={minDate}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className={ONBOARD_INPUT}
        />
        <p className="mt-3 text-xs text-dawn-ink/50 leading-relaxed max-w-[34ch] mx-auto">
          {ONBOARDING.dateLockNote}
        </p>
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
        <div className="mt-5 flex items-center justify-center gap-3">
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
        <button
          onClick={() => targetDate && setStep("ritual")}
          disabled={!targetDate}
          className={ONBOARD_CTA}
        >
          Continue
        </button>
      </OnboardScreen>
    );
  }

  if (step === "ritual") {
    return (
      <OnboardScreen
        step="ritual"
        heading={ONBOARDING.ritualHeading}
        onBack={() => setStep("date")}
      >
        <div className="space-y-3">
          {(
            [
              { id: "card", label: ONBOARDING.ritualCard, sub: ONBOARDING.ritualCardSub },
              { id: "writing", label: ONBOARDING.ritualWriting, sub: ONBOARDING.ritualWritingSub },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => commit(opt.id)}
              disabled={busy}
              className={
                "w-full p-5 rounded-2xl border transition-colors disabled:opacity-50 " +
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
        {busy && <p className="mt-4 text-xs text-dawn-ink/50 animate-pulse">Committing…</p>}
        {error && <p className="mt-4 text-xs text-dawn-rose/90">{error}</p>}
        {offlineNote && (
          <p className="mt-4 text-xs text-dawn-rose/90">
            Can't reach Dawnhalo right now — try again in a moment.
          </p>
        )}
      </OnboardScreen>
    );
  }

  return (
    <OnboardScreen step="checkin" heading={ONBOARDING.checkinHeading} sub={ONBOARDING.checkinSub}>
      <div className="space-y-3">
        {STATE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => firstCheckin(opt.id)}
            disabled={busy}
            className="w-full p-4 bg-dawn-surface border border-dawn-haze/25 rounded-2xl hover:bg-dawn-haze/10 transition-colors disabled:opacity-50"
          >
            <p className="font-serif text-lg italic">{opt.label}</p>
          </button>
        ))}
      </div>
    </OnboardScreen>
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

  const answer = async (a: "continue" | "thinking" | "done") => {
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
          </div>
        )}
      </section>

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
