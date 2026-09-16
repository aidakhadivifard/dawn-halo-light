// The page around everything — and it is a page, not an app.
//
// A small serif wordmark. One quiet word top-right to switch language. Two
// tabs at the bottom, in words, not icons. No pills, no uppercase tracking, no
// panels. The paper is the interface; everything sits directly on it.

import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { dict, type Lang } from "@/lib/i18n";

export function Shell({
  children,
  lang,
  setLang,
  dir,
}: {
  children: ReactNode;
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: "ltr" | "rtl";
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
        <button
          onClick={() => setLang(lang === "en" ? "fa" : "en")}
          className="font-serif text-[15px] text-wish-muted hover:text-wish-ink transition-colors"
        >
          {t.switchLang}
        </button>
      </header>

      <main className="mx-auto max-w-md px-6 pt-6 pb-28">{children}</main>

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
    </div>
  );
}

/** The one coral button. Coral means something is about to come alive. */
export function Primary({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        "rounded-full bg-wish-blue px-6 py-4 font-serif text-[19px] text-wish-white transition-all " +
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
