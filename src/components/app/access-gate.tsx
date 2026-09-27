// @ts-nocheck
import { type ReactNode } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { AppShell } from "./shell";
import { DeskDecisionProvider } from "@/lib/market/desk-decision";
import { LedgerSync } from "./ledger-sync";
import { useAccess } from "@/lib/use-access";
import { Clock, Lock } from "lucide-react";
import { isGuestReadablePath } from "@/lib/auth/public-routes";

/**
 * Phase 2 auth split.
 * - Board `/` and Ledger `/results` render for guests
 * - Ticket, profile, photo-lock, admin require Google sign-in
 * - Signed in but not approved: public surfaces stay readable; the rest wait
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/login" || pathname.startsWith("/api/")) return <>{children}</>;

  return <AuthGate pathname={pathname}>{children}</AuthGate>;
}

function AuthGate({ children, pathname }: { children: ReactNode; pathname: string }) {
  const { user, sessionPending, signedIn, isApproved, accessPending } = useAccess();
  const guestOk = isGuestReadablePath(pathname);

  const shell = (
    <DeskDecisionProvider>
      {signedIn ? <LedgerSync /> : null}
      <AppShell>{children}</AppShell>
    </DeskDecisionProvider>
  );

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

  if (!signedIn) {
    if (guestOk) return shell;
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center animate-in fade-in duration-500">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">SportsLock</h1>
            <p className="text-muted text-sm mt-2">
              Board and Ledger are public. Sign in to set a bankroll or photo-lock a ticket.
            </p>
          </div>
          <Link
            to="/login"
            className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm text-center hover:opacity-90 transition-opacity"
          >
            Sign in with Google
          </Link>
          <p className="text-[10px] text-muted">This site never places a bet. 1-800-GAMBLER.</p>
        </div>
      </main>
    );
  }

  if (accessPending) {
    if (guestOk) return shell;
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Checking access...</p>
        </div>
      </main>
    );
  }

  if (!isApproved) {
    if (guestOk) return shell;
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center animate-in fade-in duration-500">
          <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="size-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Access Pending</h1>
            <p className="text-muted text-sm mt-2">
              Bankroll and photo-lock wait on approval. Board and Ledger stay readable.
            </p>
            <p className="text-xs text-muted mt-3 bg-wash rounded-lg p-3">
              Signed in as <strong className="text-ink">{user?.email}</strong>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return shell;
}
