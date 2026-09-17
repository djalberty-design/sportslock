import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Combine,
  Newspaper,
  Radio,
  Sparkles,
} from "lucide-react";
import { type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { UserButton } from "@/lib/auth/gates";
import { useAccess } from "@/lib/use-access";
import { cn } from "@/lib/utils";
import { CollapsibleParlayPill } from "./collapsible-parlay-pill";
import { TicketChip } from "./ticket-lock";
import { MobileMoreDrawer } from "./mobile-more-drawer";

const PRIMARY = [
  { to: "/today", label: "AI Picks", icon: Sparkles, featured: true },
  { to: "/board", label: "Games", icon: Newspaper },
  { to: "/parlay", label: "Combos", icon: Combine },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/desk", label: "Log", icon: ClipboardList },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAccess();

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-emerald-500 focus:px-3 focus:py-2 focus:text-zinc-950"
      >
        Skip to main
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-h-11 items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-emerald-500 text-zinc-950 shadow-[var(--shadow-stamp)]">
              <LockMark />
            </span>
            <span className="leading-tight">
              <span className="font-display block text-lg font-semibold tracking-wide text-ink">{BRAND.name}</span>
             <span className="hidden text-xs uppercase tracking-[0.16em] text-emerald-500 sm:block">Intelligence. Edge. Confidence.</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <Link
                to="/admin"
                className={cn(
                  "hidden min-h-11 items-center rounded-md px-3 text-sm font-medium sm:inline-flex",
                  pathname === "/admin" ? "bg-emerald-500 text-zinc-950" : "text-muted hover:bg-wash hover:text-ink",
                )}
              >
                Admin
              </Link>
            ) : null}
            <TicketChip />
            <div className="hidden sm:block">
              <UserButton />
            </div>
            <MobileMoreDrawer />
          </div>
        </div>
        <div className="rink-rule" aria-hidden="true" />
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-32 pt-6">
        {children}
      </main>
      <CollapsibleParlayPill />

      <footer className="mx-auto hidden max-w-6xl px-4 pb-32 text-xs text-muted lg:block">
        <p>
          21+ for Hard Rock Bet. 18+ for classic daily fantasy / prediction markets. Call{" "}
          <span className="font-mono text-emerald-500">{BRAND.helpline}</span> if play is no longer fun. This site
          never places a bet. Delayed public odds. Not a prediction. Florida.
        </p>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
        aria-label="Main"
      >
        <ul className="mx-auto grid max-w-6xl grid-cols-5">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.to);
            const featured = "featured" in item && item.featured;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium uppercase tracking-wide",
                    active ? "text-emerald-500" : "text-faint hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-md",
                      featured && "size-8",
                      featured && active && "bg-emerald-500 text-zinc-950",
                      featured && !active && "bg-wash text-emerald-500",
                    )}
                  >
                    <item.icon className="size-4" strokeWidth={active || featured ? 2 : 1.6} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function LockMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" />
    </svg>
  );
}
