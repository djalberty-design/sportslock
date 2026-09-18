import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AppShell } from "./shell";
import { DeskDecisionProvider } from "@/lib/market/desk-decision";
import { LedgerSync } from "./ledger-sync";
import { useAccess } from "@/lib/use-access";

/**
 * Temporary guest desk (2026-09-18).
 * Unsigned visitors see Feed / Lab / Matchups / Ticket.
 * Signed-in admin email still gets Overseer.
 * /admin stays gated in the admin route. Fetch Props stays admin-only in the page.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/login" || pathname.startsWith("/api/")) return <>{children}</>;

  return <DeskFrame>{children}</DeskFrame>;
}

function DeskFrame({ children }: { children: ReactNode }) {
  const { sessionPending } = useAccess();

  if (sessionPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading SportsLock...</p>
        </div>
      </main>
    );
  }

  return (
    <DeskDecisionProvider>
      <LedgerSync />
      <AppShell>{children}</AppShell>
    </DeskDecisionProvider>
  );
}
