import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_POWERS, OWNER_ADMIN_EMAIL } from "@/lib/admin";
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



  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-gold">Owner desk · {OWNER_ADMIN_EMAIL}</p>
        <h1 className="font-display mt-1 text-3xl text-ink md:text-4xl">Admin settings</h1>
        <p className="mt-2 text-sm text-ink/80">
          Allowlist, algorithm knobs, master ledger, and feed health. Regular users cannot see this. This site never
          places a bet.
        </p>
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
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "min-h-11 rounded-md bg-gold px-4 text-sm font-medium text-navy-deep" : "min-h-11 rounded-md bg-wash px-4 text-sm font-medium text-muted hover:text-ink"}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "allowlist" ? <AllowlistPanel /> : null}
      {tab === "tune" ? <TuningPanel /> : null}
      {tab === "ledger" ? <LedgerPanel /> : null}
      {tab === "status" ? <StatusPanel /> : null}
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
        <p className="stamp text-gold">Approved emails</p>
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
                <span className="text-xs uppercase tracking-[0.14em] text-gold">{row.role}</span>
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
        <p className="stamp text-gold">Queue</p>
        <h2 className="font-display mt-2 text-xl text-ink">Access requests</h2>
        {(reqs.data ?? []).length ? (
          <ul className="mt-3 space-y-3">
            {reqs.data!.map((r) => (
              <li key={r.id} className="rounded-md bg-wash px-3 py-3">
                <p className="text-sm font-medium text-ink">{r.email}</p>
                <p className="text-xs text-muted">
                  {r.name || "No name"} · {r.status}
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

function TuningPanel() {
  const { settings, rankMs, ranking, scan, picks } = useDeskDecision();
  const qc = useQueryClient();
  const [floor, setFloor] = useState(String(Math.round(settings.safestFloor * 100)));
  const [kelly, setKelly] = useState(String(settings.kellyMultiplier));
  const [cap, setCap] = useState(String(settings.comboLegCap));
  const [feeds, setFeeds] = useState<SportFeeds>(settings.sportFeeds);
  const [note, setNote] = useState("");
  const games = new Set((scan?.rows ?? []).map((r) => r.eventId)).size;

  async function save() {
    setNote("");
    try {
      const next: Partial<DeskSettings> = {
        safestFloor: Number(floor) / 100,
        kellyMultiplier: Number(kelly),
        comboLegCap: Number(cap),
        sportFeeds: feeds,
      };
      const saved = await saveDeskSettings({ data: next });
      qc.setQueryData(["desk-settings"], saved);
      setNote("Saved. Ranking will refresh on the next odds snapshot.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <section className="paper-card space-y-4 p-5">
      <p className="stamp text-gold">Model knobs</p>
      <h2 className="font-display text-xl text-ink">Algorithm & thresholds</h2>
      <p className="text-sm text-muted">
        {ranking ? "Ranking in the background." : rankMs != null ? `Last pass ${rankMs} ms.` : "Waiting on the delayed board."}{" "}
        {games ? `${games} games.` : ""} {picks?.all.length ?? 0} named tickets.
      </p>
      <label className="block text-xs uppercase tracking-[0.14em] text-muted">
        Safest floor % (preferred 65)
        <Input value={floor} onChange={(e) => setFloor(e.target.value)} className="mt-1 max-w-xs" />
      </label>
      <label className="block text-xs uppercase tracking-[0.14em] text-muted">
        Kelly multiplier (1 = full)
        <Input value={kelly} onChange={(e) => setKelly(e.target.value)} className="mt-1 max-w-xs" />
      </label>
      <label className="block text-xs uppercase tracking-[0.14em] text-muted">
        Combo leg cap (8–20)
        <Input value={cap} onChange={(e) => setCap(e.target.value)} className="mt-1 max-w-xs" />
      </label>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Sport feeds</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_SPORTS.map((sport) => (
            <li key={sport}>
              <label className="flex min-h-11 items-center gap-2 rounded-md bg-wash px-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={feeds[sport]}
                  onChange={(e) => setFeeds({ ...feeds, [sport]: e.target.checked })}
                />
                {sportLabel(sport)}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <Button type="button" onClick={() => void save()}>
        Save tuning
      </Button>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </section>
  );
}

function LedgerPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["master-ledger"], queryFn: () => listMasterLedger(), staleTime: 15_000 });
  const rows = q.data?.rows ?? [];
  const a = q.data?.analytics;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniStat label="Tickets" value={String(a?.tickets ?? 0)} />
        <MiniStat label="Hit rate" value={a?.hitRate != null ? `${Math.round(a.hitRate * 100)}%` : "—"} />
        <MiniStat label="Hits / misses" value={`${a?.hits ?? 0} / ${a?.misses ?? 0}`} />
        <MiniStat label="Stake logged" value={formatBetUsd(a?.stake ?? 0)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => downloadLedger(rows)}>
          Download my bets JSON
        </Button>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="paper-card p-4">
            <p className="stamp text-gold">{row.result}</p>
            <h3 className="font-display mt-1 text-lg text-ink">{row.ticketName}</h3>
            <p className="text-xs text-muted">
              {row.userEmail || row.userId} · {formatBetUsd(row.stakeDollars)} · {formatChancePct(row.deskTrueProbability) ?? "—"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["HIT", "MISS", "PUSH", "PENDING"] as LedgerResult[]).map((result) => (
                <Button
                  key={result}
                  type="button"
                  size="sm"
                  variant={row.result === result ? "primary" : "outline"}
                  onClick={() => {
                    void updateLedgerBet({ data: { id: row.id, result } }).then((next) => {
                      qc.setQueryData(["master-ledger"], next);
                    });
                  }}
                >
                  {result === "HIT" ? "Hit" : result === "MISS" ? "Miss" : result === "PUSH" ? "Void" : "Open"}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => {
                  void updateLedgerBet({ data: { id: row.id, delete: true } }).then((next) => {
                    qc.setQueryData(["master-ledger"], next);
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="text-sm text-muted">No tickets in the master ledger yet.</p> : null}
    </section>
  );
}

function StatusPanel() {
  const q = useQuery({ queryKey: ["feed-health"], queryFn: () => getFeedHealth(), staleTime: 30_000 });
  const h = q.data;
  return (
    <section className="paper-card p-5">
      <p className="stamp text-gold">Feeds</p>
      <h2 className="font-display mt-2 text-xl text-ink">System status</h2>
      <p className="mt-2 text-sm text-muted">ESPN, Kalshi, and Polymarket. Delayed public numbers. Not a fill.</p>
      {h ? (
        <ul className="mt-4 space-y-3">
          <HealthRow name="ESPN" ping={h.espn} />
          <HealthRow name="Kalshi" ping={h.kalshi} />
          <HealthRow name="Polymarket" ping={h.polymarket} />
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{q.isPending ? "Pinging feeds…" : "Could not load health."}</p>
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
        {ping.ok ? "Up" : "Down"} · {ping.ms} ms{ping.status ? ` · ${ping.status}` : ""}
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
