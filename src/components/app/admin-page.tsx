import { useState } from "react";
import { TuningPanel } from "./tuning-panel";
import { LedgerPanel } from "./ledger-panel";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_POWERS, OWNER_ADMIN_EMAIL } from "@/lib/admin";
import { getOddsQuotaFn } from "@/lib/market/server";
import { ALL_SPORTS } from "@/lib/market/universe";
import { useDeskDecision } from "@/lib/market/use-board";
import { useAccess } from "@/lib/use-access";
import {
  addAllowlistEmail,
  decideAccessRequest,
  getFeedHealth,
  listAccessRequests,
  listAllowlist,
  listMasterLedger,
  revokeAllowlistEmail,
  saveDeskSettings,
  updateLedgerBet,
} from "@/lib/desk-api";
import { downloadLedger } from "@/lib/ledger";
import { formatBetUsd, formatChancePct } from "@/lib/copy";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sportLabel } from "@/lib/copy";
import type { DeskSettings, SportFeeds } from "@/lib/desk-settings";
import type { LedgerResult } from "@/lib/ledger";

const TABS = [
  { id: "allowlist", label: "Allowlist" },
  { id: "tune", label: "Tuning" },
  { id: "ledger", label: "Ledger" },
  { id: "status", label: "Status" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function AdminPage() {
  const { isAdmin, access } = useAccess();
  const [tab, setTab] = useState<Tab>("allowlist");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRootAdmin = pathname === "/admin";
  const quotaQuery = useQuery({ queryKey: ["odds-quota"], queryFn: () => getOddsQuotaFn(), refetchInterval: 30000 });

  return (
    <div className="space-y-6">
      <header className="max-w-2xl flex justify-between items-start">
        <div>
          <p className="text-sm text-emerald-500">Owner desk • {OWNER_ADMIN_EMAIL}</p>
          <h1 className="font-display mt-1 text-3xl text-ink md:text-4xl">Admin settings</h1>
          <p className="mt-2 text-sm text-ink/80">
            Allowlist, algorithm knobs, master ledger, and feed health.
          </p>
        </div>
        <div className="bg-paper border border-line p-3 rounded-xl flex flex-col items-center">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">Odds API Quota</span>
          <span className="text-2xl font-display text-emerald-500">{quotaQuery.data !== null && quotaQuery.data !== undefined ? quotaQuery.data : "---"}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted mt-1">/ 500 Remaining</span>
        </div>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {ADMIN_POWERS.map((p) => (
          <li key={p.id} className="rounded-md bg-wash px-3 py-2">
            <p className="text-sm font-medium text-ink">{p.title}</p>
            <p className="text-xs text-muted">{p.line}</p>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to="/admin"
            type="button"
            role="tab"
            aria-selected={isRootAdmin && tab === t.id}
            onClick={() => setTab(t.id)}
            className={isRootAdmin && tab === t.id ? "min-h-11 rounded-md bg-emerald-500/10 flex items-center justify-center px-4 text-sm font-bold text-emerald-400 border border-emerald-500/50" : "min-h-11 rounded-md bg-wash flex items-center justify-center px-4 text-sm font-medium text-muted hover:text-ink"}
          >
            {t.label}
          </Link>
        ))}
        <Link
          to="/admin/architect"
          className="min-h-11 rounded-md bg-wash flex items-center justify-center px-4 text-sm font-medium text-muted hover:text-ink"
          activeProps={{ className: "min-h-11 rounded-md bg-emerald-500/10 flex items-center justify-center px-4 text-sm font-bold text-emerald-400 border border-emerald-500/50" }}
        >
          Architect
        </Link>
        <Link
          to="/admin/terminal"
          className="min-h-11 rounded-md bg-wash flex items-center justify-center px-4 text-sm font-medium text-muted hover:text-ink"
          activeProps={{ className: "min-h-11 rounded-md bg-emerald-500/10 flex items-center justify-center px-4 text-sm font-bold text-emerald-400 border border-emerald-500/50" }}
        >
          Terminal
        </Link>
        <Link
          to="/admin/brain"
          className="min-h-11 rounded-md bg-wash flex items-center justify-center px-4 text-sm font-medium text-muted hover:text-ink"
          activeProps={{ className: "min-h-11 rounded-md bg-emerald-500/10 flex items-center justify-center px-4 text-sm font-bold text-emerald-400 border border-emerald-500/50" }}
        >
          Brain
        </Link>
      </div>

      {isRootAdmin && tab === "allowlist" ? <AllowlistPanel /> : null}
      {isRootAdmin && tab === "tune" ? <TuningPanel /> : null}
      {isRootAdmin && tab === "ledger" ? <LedgerPanel /> : null}
      {isRootAdmin && tab === "status" ? <StatusPanel /> : null}
      
      <Outlet />
    </div>
  );
}

function AllowlistPanel() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["allowlist"], queryFn: () => listAllowlist(), staleTime: 10_000 });
  const reqs = useQuery({ queryKey: ["access-requests"], queryFn: () => listAccessRequests(), staleTime: 10_000 });
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");

  async function add() {
    setNote("");
    try {
      const rows = await addAllowlistEmail({ data: { email: draft, role: "user" } });
      qc.setQueryData(["allowlist"], rows);
      setDraft("");
      setNote("Approved.");
      void qc.invalidateQueries({ queryKey: ["access-requests"] });
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not add that email.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="paper-card p-5">
        <p className="stamp text-emerald-500">Approved emails</p>
        <h2 className="font-display mt-2 text-xl text-ink">Allowlist</h2>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="friend@email.com"
            className="max-w-md normal-case tracking-normal"
          />
          <Button type="submit">Add user</Button>
        </form>
        {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
        <ul className="mt-4 divide-y divide-line">
          {(list.data ?? []).map((row) => (
            <li key={row.email} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <span>
                <span className="block text-sm text-ink">{row.email}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-emerald-500">{row.role}</span>
              </span>
              {row.email === OWNER_ADMIN_EMAIL ? (
                <span className="text-xs text-muted">Super admin</span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void revokeAllowlistEmail({ data: { email: row.email } }).then((rows) => {
                      qc.setQueryData(["allowlist"], rows);
                      void qc.invalidateQueries({ queryKey: ["access-requests"] });
                    });
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="paper-card p-5">
        <p className="stamp text-emerald-500">Queue</p>
        <h2 className="font-display mt-2 text-xl text-ink">Access requests</h2>
        {(reqs.data ?? []).length ? (
          <ul className="mt-3 space-y-3">
            {reqs.data!.map((r) => (
              <li key={r.id} className="rounded-md bg-wash px-3 py-3">
                <p className="text-sm font-medium text-ink">{r.email}</p>
                <p className="text-xs text-muted">
                  {r.name || "No name"} Ãƒâ€šÃ‚Â· {r.status}
                </p>
                {r.status === "pending" ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        void decideAccessRequest({ data: { email: r.email, approve: true } }).then((rows) => {
                          qc.setQueryData(["access-requests"], rows);
                          void qc.invalidateQueries({ queryKey: ["allowlist"] });
                        });
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void decideAccessRequest({ data: { email: r.email, approve: false } }).then((rows) => {
                          qc.setQueryData(["access-requests"], rows);
                        });
                      }}
                    >
                      Deny
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No requests yet.</p>
        )}
      </section>
    </div>
  );
}



function StatusPanel() {
  const q = useQuery({ queryKey: ["feed-health"], queryFn: () => getFeedHealth(), staleTime: 30_000 });
  const h = q.data;
  return (
    <section className="paper-card p-5">
      <p className="stamp text-emerald-500">Feeds</p>
      <h2 className="font-display mt-2 text-xl text-ink">System status</h2>
      <p className="mt-2 text-sm text-muted">ESPN, Kalshi, and Polymarket. Delayed public numbers. Not a fill.</p>
      {h ? (
        <ul className="mt-4 space-y-3">
          <HealthRow name="ESPN" ping={h.espn} />
          <HealthRow name="Kalshi" ping={h.kalshi} />
          <HealthRow name="Polymarket" ping={h.polymarket} />
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{q.isPending ? "Pinging feedsÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦" : "Could not load health."}</p>
      )}
      <Button type="button" variant="outline" className="mt-4" onClick={() => void q.refetch()}>
        Ping again
      </Button>
    </section>
  );
}

function HealthRow({ name, ping }: { name: string; ping: { ok: boolean; ms: number; status: number } }) {
  return (
    <li className="flex items-center justify-between rounded-md bg-wash px-3 py-3">
      <span className="text-sm font-medium text-ink">{name}</span>
      <span className={ping.ok ? "text-sm text-up" : "text-sm text-down"}>
        {ping.ok ? "Up" : "Down"} Ãƒâ€šÃ‚Â· {ping.ms} ms{ping.status ? ` Ãƒâ€šÃ‚Â· ${ping.status}` : ""}
      </span>
    </li>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl text-ink">{value}</p>
    </div>
  );
}
