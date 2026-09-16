import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
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
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="flex min-h-11 w-full items-center justify-center rounded-md bg-gold px-4 text-sm font-medium text-navy-deep hover:opacity-90"
              >
                Continue with {p.label}
              </button>
            ))
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
              {busy ? "Working…" : mode === "in" ? "Sign in with email" : "Create account"}
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
