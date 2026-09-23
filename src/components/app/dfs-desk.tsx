// @ts-nocheck
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Copy, ShieldAlert } from "lucide-react";
import { ScreenshotIngest, PhotoFirstNote } from "./screenshot-ingest";
import { useDeskStore } from "@/lib/desk-store";
import { useDeskDecision } from "@/lib/market/use-board";
import { suggestContests } from "@/lib/market/dfs";
import { applyGameLean, lineupExport, optimizeSlate, teamLeansFromBoard } from "@/lib/market/slate";
import { cashFloor, gppCeiling, isChalk, showdownPoints, showdownSalary } from "@/lib/market/dfs-scoring";
import { DFS_DISCLAIMER, chalkPivots, valueBridgeNotes } from "@/lib/market/dfs-law";
import { formatBetUsd } from "@/lib/copy";
import { formatUsd } from "@/lib/utils";
import type { InactiveAlert, SalaryShift, SlateLineup } from "@/lib/market/types";

export function DfsDesk({ variant = "full" }: { variant?: "full" | "today" }) {
  const slate = useDeskStore((s) => s.slate);
  const contests = useDeskStore((s) => s.contests ?? []);
 const liveBankroll = useDeskStore((s) => s.dfsBankroll || s.liveBankroll);
  const loadSampleSlate = useDeskStore((s) => s.loadSampleSlate);
  const rec = suggestContests(liveBankroll, contests);
  const { scan, snapshot } = useDeskDecision();
  const leans = useMemo(
    () => teamLeansFromBoard(scan?.rows ?? [], snapshot?.briefs, snapshot?.predict),
    [scan, snapshot],
  );
  const scored = useMemo(() => {
    if (!slate?.confirmed) return slate;
    const players = applyGameLean(slate.players, leans, slate.sport);
    return optimizeSlate({
      site: slate.site,
      sport: slate.sport,
      slateDate: slate.slateDate,
      cap: slate.cap,
      players,
      source: slate.source,
      confirmed: true,
      salaryShifts: slate.salaryShifts,
    });
  }, [slate, leans]);

  return (
    <section className="space-y-4">
      <header className="max-w-3xl">
        <p className="stamp text-emerald-500">Daily fantasy — NFL, NBA, MLB, NHL</p>
        <h2 className="font-display mt-2 text-2xl text-ink md:text-3xl">
          Photograph the contest. We name a roster and a buy-in.
        </h2>
        <p className="mt-2 text-sm text-ink/80">
          This is DraftKings Fantasy — a salary-cap roster, not a Hard Rock bet on one team. 18+. We never submit the lineup.
          Take a picture of the player salaries and the contest list. We pick a safer lineup, a high-ceiling tournament lineup,
          a single-game Showdown captain, and the buy-in that matches 1% of your money ({formatBetUsd(rec.target)} on{" "}
          {formatUsd(liveBankroll)}).
        </p>
      </header>

      <p className="rounded-md bg-wash px-4 py-3 text-sm text-ink/80">{DFS_DISCLAIMER}</p>

      <PhotoFirstNote venue="DraftKings Fantasy" />

      <a
        href="#lock-in"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-base font-medium text-zinc-950 transition-transform duration-150 ease-out active:scale-[0.96] sm:w-auto"
      >
        <Camera className="size-4" strokeWidth={1.75} />
        Confirm with DraftKings Photo
      </a>

      <SalaryShiftBanner shifts={scored?.salaryShifts ?? slate?.salaryShifts} />
      <InactiveBanner alerts={scored?.inactiveAlerts} />
      <ValueBridge players={scored?.players ?? slate?.players} />

      <div className="grid gap-4 md:grid-cols-2">
        <article className="paper-card p-5">
          <p className="stamp text-emerald-500">Buy-in</p>
          <h3 className="font-display mt-2 text-xl text-ink">What to enter</h3>
          <p className="mt-2 text-sm text-ink/80">{rec.note}</p>
          {rec.cash ? (
            <p className="mt-3 text-base font-medium text-ink">
              Safer contest: {rec.cash.name} · {formatBetUsd(rec.cash.buyIn)} to enter
            </p>
          ) : null}
          {rec.cashWarning ? <p className="mt-1 text-sm text-down">{rec.cashWarning}</p> : null}
          {rec.gpp ? (
            <p className="mt-2 text-sm text-ink">
              High-ceiling tournament: {rec.gpp.name} · {formatBetUsd(rec.gpp.buyIn)} to enter
            </p>
          ) : null}
          {rec.gppWarning ? <p className="mt-1 text-sm text-down">{rec.gppWarning}</p> : null}
          {!rec.photographed ? (
            <p className="mt-3 text-xs text-muted">
              Photograph today's lobby to replace typical rungs with what's actually up. We will not lock a buy-in without that photo.
            </p>
          ) : (
            <p className="mt-3 text-xs text-emerald-500">Using the contest list you confirmed.</p>
          )}
        </article>
        <article className="paper-card p-5">
          <p className="stamp text-emerald-500">How to shoot it</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink/90">
            <li>Open DraftKings Fantasy (not Sportsbook — Sportsbook is not legal in Florida).</li>
            <li>Screenshot the contest lobby so we can read the buy-ins.</li>
            <li>Screenshot the player list with salaries. We flag live salary shifts of $200 or more.</li>
            <li>Confirm the numbers. Safer = cash floor. High-ceiling = GPP double-stack + bring-back. Showdown captain is 1.5×.</li>
          </ol>
          {variant === "today" ? (
            <div className="mt-4">
              <Link
                to="/slate"
                className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
              >
                Open the full roster builder
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => loadSampleSlate()}
              className="mt-4 inline-flex min-h-11 items-center rounded-md bg-wash px-3 text-sm font-medium text-emerald-500 hover:text-ink"
            >
              Load practice NFL slate
            </button>
          )}
        </article>
      </div>

      <ScreenshotIngest kind="auto" heading="Confirm with DraftKings Photo — contest list or player salaries" />

      {scored?.confirmed && (scored.cash || scored.gpp || scored.showdown) ? (
        <div className={variant === "today" ? "grid gap-4 md:grid-cols-2" : "grid gap-4 lg:grid-cols-3"}>
          {scored.cash ? <LineupCard title="Safer lineup" kicker="Cash / 50-50 · high-touch floor" lineup={scored.cash} /> : null}
          {scored.gpp ? (
            <LineupCard title="High-ceiling lineup" kicker="Tournament / GPP · double-stack + bring-back" lineup={scored.gpp} />
          ) : null}
          {variant === "full" && scored.showdown ? (
            <LineupCard title="Showdown captain" kicker="Single-game · 1.5× salary and 1.5× points" lineup={scored.showdown} />
          ) : null}
        </div>
      ) : (
        <p className="paper-card p-5 text-sm text-muted">
          <Camera className="mr-2 inline size-4" strokeWidth={1.75} />
          Empty slate. Photograph the player list, then confirm. We will not invent a roster without that photo.
        </p>
      )}
    </section>
  );
}

function SalaryShiftBanner({ shifts }: { shifts?: SalaryShift[] }) {
  if (!shifts?.length) return null;
  return (
    <div className="rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500" role="status">
      <p className="font-medium">Salary shift on DraftKings</p>
      <ul className="mt-1 space-y-1">
        {shifts.map((s) => (
          <li key={s.name}>
            {s.name}: was {formatUsd(s.was, 0)}, now {formatUsd(s.now, 0)}. Photograph DraftKings before you lock the salary.
          </li>
        ))}
      </ul>
    </div>
  );
}

function InactiveBanner({ alerts }: { alerts?: InactiveAlert[] }) {
  if (!alerts?.length) return null;
  return (
    <div className="rounded-md bg-wash px-4 py-3 text-sm text-ink" role="status">
      <p className="flex items-center gap-2 font-medium text-emerald-500">
        <ShieldAlert className="size-4" strokeWidth={1.75} />
        Injury ripple & 90-minute inactive radar
      </p>
      <ul className="mt-2 space-y-1 text-ink/80">
        {alerts.map((a) => (
          <li key={`${a.playerId}-${a.kind}`}>{a.line}</li>
        ))}
      </ul>
    </div>
  );
}

function LineupCard({ title, kicker, lineup }: { title: string; kicker: string; lineup: SlateLineup }) {
  const [copied, setCopied] = useState(false);
  const floor = lineup.players.reduce((s, p) => {
    const f = cashFloor(p);
    return s + (lineup.captainId === p.id ? showdownPoints(f, true) : f);
  }, 0);
  const ceil = lineup.players.reduce((s, p) => {
    const c = gppCeiling(p);
    return s + (lineup.captainId === p.id ? showdownPoints(c, true) : c);
  }, 0);
  function copy() {
    const text = lineupExport(lineup);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }
  return (
    <article className="paper-card flex flex-col p-5">
      <p className="stamp text-emerald-500">{kicker}</p>
      <h3 className="font-display mt-2 text-xl text-ink">{title}</h3>
      <p className="mt-1 font-mono text-xs text-muted">
        Cap {formatUsd(lineup.capUsed, 0)} / {formatUsd(lineup.cap, 0)} · floor {floor.toFixed(1)} · median {lineup.projP50.toFixed(1)} ·
        ceiling {ceil.toFixed(1)}
      </p>
      {lineup.stackNote ? <p className="mt-2 text-sm text-ink/80">{lineup.stackNote}</p> : null}
      <ul className="mt-3 divide-y divide-line text-sm">
        {lineup.players.map((p) => {
          const captain = lineup.captainId === p.id;
          const salary = captain ? showdownSalary(p.salary, true) : p.salary;
          return (
            <li key={p.id} className="flex justify-between gap-3 py-1.5">
              <span>
                <span className="stamp mr-2 text-muted">{captain ? "CPT" : p.pos}</span>
                {p.name}
                {isChalk(p.ownershipEst) ? <span className="ml-2 text-xs text-emerald-500">chalk</span> : null}
                {p.researchNote ? <span className="mt-0.5 block text-xs text-muted">{p.researchNote}</span> : null}
              </span>
              <span className="font-mono tabular-nums">${salary.toLocaleString()}</span>
            </li>
          );
        })}
      </ul>
      {lineup.warnings.length ? (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {lineup.warnings
            .filter((w) => w !== lineup.stackNote)
            .map((w) => (
              <li key={w}>{w}</li>
            ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-wash px-3 text-sm font-medium text-ink hover:text-emerald-500"
        >
          <Copy className="size-4" strokeWidth={1.75} />
          {copied ? "Copied" : "Copy roster"}
        </button>
        <a
          href="#lock-in"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-500 px-3 text-sm font-medium text-zinc-950"
        >
          <Camera className="size-4" strokeWidth={1.75} />
          Confirm with DraftKings Photo
        </a>
      </div>
    </article>
  );
}

function ValueBridge({ players }: { players?: import("@/lib/market/types").SlatePlayer[] }) {
  const list = players ?? [];
  const notes = [...valueBridgeNotes(list), ...chalkPivots(list)];
  if (!notes.length) return null;
  return (
    <div className="rounded-md bg-wash px-4 py-3 text-sm text-ink/80">
      <p className="stamp text-emerald-500">Value bridge · Fantasy only</p>
      <ul className="mt-2 space-y-1">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
