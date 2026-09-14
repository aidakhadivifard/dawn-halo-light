// Three places, white and blue. The wish is home; everything else is behind it.

import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Wish" },
  { to: "/today", label: "Today" },
  { to: "/settings", label: "Settings" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-wish-paper/90 backdrop-blur-xl border-t border-wish-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <ul className="mx-auto flex max-w-md justify-around items-center">
        {items.map((it) => {
          const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={
                  "flex flex-col items-center gap-1 px-4 py-1 transition-colors " +
                  (active ? "text-wish-blue" : "text-wish-muted hover:text-wish-ink")
                }
              >
                <span
                  className={
                    "size-1.5 rounded-full " +
                    (active ? "bg-wish-blue shadow-[0_0_10px_rgba(47,107,255,0.7)]" : "bg-current opacity-50")
                  }
                />
                <span className="text-[12px] uppercase tracking-[0.16em] font-medium">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
