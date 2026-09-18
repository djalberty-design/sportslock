import { type ReactNode } from "react";
import { useRouterState, Navigate } from "@tanstack/react-router";
import { AppShell } from "./shell";
import { DeskDecisionProvider } from "@/lib/market/desk-decision";
import { LedgerSync } from "./ledger-sync";
import { useAccess } from "@/lib/use-access";
import { requestAccess } from "@/lib/desk-api";
import { Lock, Clock, ShieldCheck } from "lucide-react";
import { useState } from "react";

/**
 * Required auth gate. Login required for all pages.
 * Approved users → full desk access.
 * Unapproved users → "Access Pending" screen.
 * /login and /api paths bypass the gate.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  
  // /login and /api routes bypass the gate
  if (pathname === "/login" || pathname.startsWith("/api/")) return <>{children}</>;
  
  return <AuthWall>{children}</AuthWall>;
}

function AuthWall({ children }: { children: ReactNode }) {
  const { user, sessionPending, accessPending, isApproved, signedIn, access, accessError, refetch } = useAccess();
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Loading state — show spinner while session or access is being resolved
  if (sessionPending || accessPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading SportsLock...</p>
        </div>
      </main>
    );
  }

  // Not signed in → redirect to login
  if (!signedIn) {
    return <Navigate to="/login" />;
  }

  // Access check errored (e.g. server threw UnauthorizedError) — show retry
  if (accessError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 size-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <Lock className="size-8 text-red-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Session Error</h1>
          <p className="mt-3 text-sm text-muted max-w-xs mx-auto">
            Could not verify your access. This can happen if your session expired.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Try Again
            </button>
            <a
              href="/login"
              className="inline-flex items-center gap-2 bg-wash hover:bg-line text-ink font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Sign In Again
            </a>
          </div>
          <p className="mt-8 text-xs text-muted">
            Signed in as {user?.primaryEmail ?? user?.displayName ?? "unknown"}
          </p>
        </div>
      </main>
    );
  }

  // Signed in but not approved → Access Pending
  if (!isApproved) {
    const isPending = access?.requestStatus === "pending" || requested;

    const handleRequest = async () => {
      setRequesting(true);
      try {
        await requestAccess();
        setRequested(true);
      } catch (e) {
        console.error(e);
      }
      setRequesting(false);
    };

    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 size-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            {isPending ? (
              <Clock className="size-8 text-amber-500" />
            ) : (
              <Lock className="size-8 text-amber-500" />
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {isPending ? "Access Pending" : "Access Required"}
          </h1>
          <p className="mt-3 text-sm text-muted max-w-xs mx-auto">
            {isPending
              ? "Your request has been sent. The admin will review and approve your access shortly."
              : "SportsLock requires admin approval. Request access to get started."}
          </p>
          {!isPending && (
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="size-4" />
              {requesting ? "Requesting..." : "Request Access"}
            </button>
          )}
          <p className="mt-8 text-xs text-muted">
            Signed in as {user?.primaryEmail ?? user?.displayName ?? "unknown"}
          </p>
        </div>
      </main>
    );
  }

  // Approved → full desk access
  return (
    <DeskDecisionProvider>
      <LedgerSync />
      <AppShell>{children}</AppShell>
    </DeskDecisionProvider>
  );
}
