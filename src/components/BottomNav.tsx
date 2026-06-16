import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Today" },
  { to: "/saved", label: "Saved" },
  { to: "/calendar", label: "Calendar" },
  { to: "/settings", label: "Settings" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-t border-dawn-ink/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <ul className="mx-auto flex max-w-md justify-around items-center">
        {items.map((it) => {
          const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={
                  "flex flex-col items-center gap-1 px-3 py-1 " +
                  (active ? "text-dawn-rose" : "text-dawn-ink/40 hover:text-dawn-ink/70 transition-colors")
                }
              >
                <span className={"size-1.5 rounded-full " + (active ? "bg-dawn-rose" : "bg-current")} />
                <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
