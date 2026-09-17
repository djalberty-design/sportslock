"use client";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="h-10 w-48 animate-pulse rounded-md bg-wash" />
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: email.trim().split("@")[0] || "Sports Lock",
        });
        if (err) throw new Error(err.message ?? "Could not create the account.");
      } else {
        const { error: err } = await authClient.signIn.email({ email: email.trim(), password });
        if (err) throw new Error(err.message ?? "Could not sign in.");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <p className="text-sm text-gold">{BRAND.kicker}</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Owner sign in</h1>
        <p className="mt-3 text-sm text-ink/80">
          The desk is open to everyone. Sign in only if you need Admin access via Google or Email. This site never places a bet.
        </p>

                  <section className="paper-card mt-6 space-y-3 p-5">
            {authEnabled ? (
              <button
                type="button"
                className="w-full flex justify-center items-center gap-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    console.log("Triggering Google OAuth...");
                    await authClient.signIn.social({
                      provider: "google",
                      callbackURL: "/admin/terminal",
                    });
                  } catch (err) {
                    console.error(err);
                    alert("Error: " + (err instanceof Error ? err.message : String(err)));
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            ) : (
              <p className="text-sm text-muted">Sign-in is disabled.</p>
            )}
          </section>

        <section className="paper-card mt-4 p-5">
          <p className="stamp text-gold">{mode === "in" ? "Email & password" : "New account"}</p>
          <form className="mt-4 space-y-3" onSubmit={onEmail}>
            <label className="block text-xs uppercase tracking-[0.14em] text-muted">
              Your email
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 normal-case tracking-normal"
                required
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.14em] text-muted">
              Password
              <Input
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 normal-case tracking-normal"
                minLength={8}
                required
              />
            </label>
            {error ? <p className="text-sm text-down">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy || !authEnabled}>
              {busy ? "Workingâ€¦" : mode === "in" ? "Sign in with email" : "Create account"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-3 text-sm text-gold underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </section>

        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-gold underline-offset-4 hover:underline"
        >
          Use the desk without signing in
        </Link>

        <p className="mt-6 text-xs text-muted">
          21+ for Hard Rock Bet. 18+ for classic daily fantasy. Call {BRAND.helpline} if play is no longer fun.
        </p>
      </div>
    </main>
  );
}
