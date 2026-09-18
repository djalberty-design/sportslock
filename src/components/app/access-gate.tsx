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
 * /login stays a clean sign-in page (no chrome).
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  
  // /login bypasses the gate
  if (pathname === "/login") return <>{children}</>;
  
  return <AuthWall>{children}</AuthWall>;
}

function AuthWall({ children }: { children: ReactNode }) {
  const { user, sessionPending, accessPending, isApproved, signedIn, access } = useAccess();
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Loading state
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
            Signed in as {user?.email}
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
