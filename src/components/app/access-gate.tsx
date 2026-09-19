import { type ReactNode } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { AppShell } from "./shell";
import { DeskDecisionProvider } from "@/lib/market/desk-decision";
import { LedgerSync } from "./ledger-sync";
import { useAccess } from "@/lib/use-access";
import { ShieldCheck, Clock, Lock } from "lucide-react";

/**
 * Auth-gated access (2026-09-19).
 * - Not signed in → login page
 * - Signed in but not approved → "Access Pending" screen
 * - Approved → full app
 * - Admin → full app + Overseer
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/login" || pathname.startsWith("/api/")) return <>{children}</>;

  return <AuthGate>{children}</AuthGate>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, sessionPending, signedIn, isApproved, accessPending, access } = useAccess();

  // Session loading
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

  // Not signed in → login wall
  if (!signedIn) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center animate-in fade-in duration-500">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">SportsLock AI</h1>
            <p className="text-muted text-sm mt-2">
              Research-grade sports betting intelligence. Sign in to access the desk.
            </p>
          </div>
          <Link
            to="/login"
            className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm text-center hover:opacity-90 transition-opacity"
          >
            Sign in with Google
          </Link>
          <p className="text-[10px] text-muted">
            New users will be reviewed for access after signing in.
          </p>
        </div>
      </main>
    );
  }

  // Signed in but access still loading
  if (accessPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Checking access...</p>
        </div>
      </main>
    );
  }

  // Signed in but not approved
  if (!isApproved) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center animate-in fade-in duration-500">
          <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="size-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Access Pending</h1>
            <p className="text-muted text-sm mt-2">
              Your access request has been submitted. The admin will review it shortly.
            </p>
            <p className="text-xs text-muted mt-3 bg-wash rounded-lg p-3">
              Signed in as <strong className="text-ink">{user?.email}</strong>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Approved → show the app
  return (
    <DeskDecisionProvider>
      <LedgerSync />
      <AppShell>{children}</AppShell>
    </DeskDecisionProvider>
  );
}
