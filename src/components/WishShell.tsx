// The page around everything — and it is a page, not an app.
//
// A small serif wordmark. Top-right, the word Language and a menu — a real
// <select>, so on a phone it opens the picker the person already knows, and
// so the list has room to grow past two. Two tabs at the bottom, in words, not
// icons. No pills, no uppercase tracking, no panels. The paper is the
// interface; everything sits directly on it.

import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { dict, LANGS, type Lang } from "@/lib/i18n";

export function Shell({
  children,
  lang,
  setLang,
  dir,
  /**
   * The tabs only appear once there is something behind them. Before the
   * first card is kept, "Notebook" is a word for a thing that does not exist
   * yet — it teaches nothing and takes attention from the one thing that
   * matters on the first screen.
   */
  nav = true,
}: {
  children: ReactNode;
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: "ltr" | "rtl";
  nav?: boolean;
}) {
  const t = dict(lang);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/", label: t.navWish },
    { to: "/notebook", label: t.navNotebook },
  ] as const;

  return (
    <div dir={dir} className="min-h-dvh bg-wish-paper text-wish-ink">
      <header className="mx-auto max-w-md flex items-baseline justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="font-serif text-[19px] text-wish-ink">Dawnhalo</span>
        <label className="flex items-baseline gap-2">
          <span className="font-serif text-[13px] text-wish-muted/80">{t.language}</span>
          {/* The current language is drawn as text so the control is exactly as
              wide as the word it shows; the real <select> lies invisibly over
              it, so a tap still opens the phone's own picker. */}
          <span className="relative inline-flex items-baseline gap-1.5">
            <span className="font-serif text-[15px] text-wish-ink">
              {(LANGS.find((l) => l.code === lang) ?? LANGS[0]).label}
            </span>
            <svg
              aria-hidden
              viewBox="0 0 10 6"
              className="w-2.5 text-wish-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 1 L5 5 L9 1" />
            </svg>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t.language}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </header>

      <main className={"mx-auto max-w-md px-6 pt-6 " + (nav ? "pb-28" : "pb-16")}>{children}</main>

      {nav && (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-wish-paper/95 backdrop-blur border-t border-wish-line">
        <ul className="mx-auto max-w-md flex justify-center gap-14 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {tabs.map((tab) => {
            const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={
                    "font-serif text-[17px] transition-colors " +
                    (active ? "text-wish-ink" : "text-wish-muted hover:text-wish-ink")
                  }
                >
                  {tab.label}
                  {active && <span aria-hidden className="block mx-auto mt-1 size-1 rounded-full bg-wish-blue" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}
    </div>
  );
}

/** The one coral button. Coral means something is about to come alive. */
export function Primary({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        // Deep plum on coral, not white. White on this coral is 2.7:1 — it
        // looks soft and reads badly, especially in a light serif. Plum is
        // 4.7:1, passes on its own merits, and is the more distinctive of
        // the two anyway.
        "rounded-full bg-wish-blue px-6 py-4 font-serif font-medium text-[19px] text-wish-ink transition-all " +
        "active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 " +
        className
      }
    >
      {children}
    </button>
  );
}

export function Secondary({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={"px-4 py-2 font-serif text-[16px] text-wish-muted transition-colors hover:text-wish-ink " + className}
    >
      {children}
    </button>
  );
}

/** The three answers. Identical on purpose: none of them is the good one. */
export function Choice({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        "w-full rounded-full border border-wish-ink/30 bg-transparent px-6 py-3.5 text-center font-serif text-[18px] text-wish-ink " +
        "transition-colors hover:border-wish-ink active:scale-[0.99] disabled:opacity-40 " +
        className
      }
    >
      {children}
    </button>
  );
}
