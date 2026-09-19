import { Button } from "@/components/ui/button";
import { useDeskStore, selectTicketPulse } from "@/lib/desk-store";
import { formatBetUsd, formatChancePct, profitOnStake } from "@/lib/copy";
import { formatAmerican } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { ScreenshotIngest } from "./screenshot-ingest";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { postMortem } from "@/lib/market/post-mortem";
import { downloadLedger, paperToLedger } from "@/lib/ledger";
import { ledgerBrier, pendingLayerHaircuts } from "@/lib/market/ledger-law";
import { DESK_VERSION } from "@/lib/market/rules";
import { BankrollTracker } from "./bankroll-tracker";
import { useDeskDecision } from "@/lib/market/use-board";

export function DeskPage() {
  const { snapshot } = useDeskDecision();
  const paperTickets = useDeskStore((s) => s.paperTickets);
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const weekAnchor = useDeskStore((s) => s.weekAnchorBankroll);
  const selfExcluded = useDeskStore((s) => s.selfExcluded);
  const grade = useDeskStore((s) => s.gradeTicket);
  const resetPaper = useDeskStore((s) => s.resetPaper);
  const setSelfExcluded = useDeskStore((s) => s.setSelfExcluded);
  const pulse = selectTicketPulse({ paperTickets });
  const open = paperTickets.filter((t) => t.status === "open");
  const settled = paperTickets.filter((t) => t.status === "win" || t.status === "loss" || t.status === "void");
  const weekPnl = liveBankroll - weekAnchor;
  const entries = paperTickets.map(paperToLedger);
  const brier = ledgerBrier(entries);
  const haircuts = pendingLayerHaircuts(entries);

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-emerald-500">Fast Logged tickets wait here</p>
        <h1 className="font-display mt-2 text-3xl text-ink">Log</h1>
        <p className="mt-3 text-ink/80">
          Fast Log a ticket. Confirm the line. After the game, tap Hit or Miss. This site never places the bet.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Open"
          value={open.length ? formatBetUsd(pulse.atRisk) : "$0"}
          note={open.length ? `${open.length} waiting on a game` : "Nothing waiting"}
          gold={open.length > 0}
        />
        <Stat
          label="This week"
          value={formatBetUsd(weekPnl)}
          note="Profit or loss"
          up={weekPnl > 0}
          down={weekPnl < 0}
        />
        <Stat
          label="Hit / Miss"
          value={`${pulse.wonCount} hit · ${pulse.lostCount} miss`}
          note={pulse.net ? `Logged ${formatBetUsd(pulse.net)}` : "Record after you tap"}
          up={pulse.net > 0}
          down={pulse.net < 0}
        />
      </div>
<section>
        <h2 className="font-display text-2xl text-ink">Waiting</h2>
        {open.length ? (
          <ul className="mt-3 grid gap-3">
            {open.map((t) => {
              const pay = t.price != null ? profitOnStake(t.stake, t.price) : null;
              // Check if this game is live or final from the snapshot
              const matchQuote = snapshot?.quotes.find((q) =>
                (t.gameIds || []).includes(q.eventId) ||
                (t.home && t.away && q.home?.toLowerCase().includes(t.home.toLowerCase()) && q.away?.toLowerCase().includes(t.away.toLowerCase()))
              );
              const isLive = matchQuote?.inPlay;
              const isFinal = matchQuote?.statusText?.toLowerCase().includes("final") || (matchQuote as any)?.complete;
              const liveScore = matchQuote && (matchQuote.homeScore != null) ? `${matchQuote.awayScore} - ${matchQuote.homeScore}` : null;
              
              return (
                <li key={t.id} className={cn("paper-card p-5", isLive && "ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]")}>
                  <div className="flex items-center gap-2">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400 ring-1 ring-red-500/30 animate-pulse">
                        <span className="size-1.5 rounded-full bg-red-400" />
                        LIVE
                      </span>
                    ) : isFinal ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/15 px-2.5 py-0.5 text-xs font-bold text-zinc-400 ring-1 ring-zinc-500/30">
                        FINAL
                      </span>
                    ) : (
                      <p className="stamp text-emerald-500">Waiting</p>
                    )}
                    {liveScore && (
                      <span className="font-mono text-sm font-bold text-ink">{liveScore}</span>
                    )}
                  </div>
                  <h3 className="font-display mt-2 text-xl text-ink">{t.description}</h3>
                  {t.home && t.away ? (
                    <p className="mt-1 text-sm text-muted">
                      {t.away} at {t.home}
                      {matchQuote?.statusText ? ` · ${matchQuote.statusText}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-ink">
                    {formatChancePct(t.chance) ? `${formatChancePct(t.chance)} % to hit` : "Chance not posted"}
                    {t.livePrice != null || t.price != null
                      ? ` · Hard Rock ${formatAmerican(t.livePrice ?? t.price!)}`
                      : ""}
                  </p>
                  <p className="mt-2 text-base text-ink">
                    If it hits you get {pay ? formatBetUsd(pay.total) : "the payout"}. If it misses you lose{" "}
                    {formatBetUsd(t.stake)}.
                  </p>
                  {isFinal && (
                    <p className="mt-2 text-sm text-amber-400 font-medium">
                      ⚠️ Game is final — tap Hit, Miss, or Push to close this ticket
                    </p>
                  )}
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Button className="min-h-14 text-base" onClick={() => grade(t.id, "win", t.livePrice ?? t.price)}>
                      Hit
                    </Button>
                    <Button
                      className="min-h-14 text-base"
                      variant="outline"
                      onClick={() => grade(t.id, "loss", t.livePrice ?? t.price)}
                    >
                      Miss
                    </Button>
                    <Button className="min-h-14 text-base" variant="ghost" onClick={() => grade(t.id, "void")}>
                      Push
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="paper-card mt-3 p-5">
            <p className="text-base text-ink">Nothing waiting. Fast Log a ticket from the board to start.</p>
            <div className="mt-4 rounded-lg border border-panel-border bg-obsidian p-4">
              <ScreenshotIngest kind="ticket" heading="Upload a Custom Parlay" />
              <p className="mt-2 text-xs text-muted">Only use this to upload a screenshot of a custom parlay that cannot be built on SportsLock.</p>
            </div>
          </div>
        )}
      </section>

      {open.length ? (
        <details className="paper-card p-5">
          <summary className="cursor-pointer text-sm font-medium text-emerald-500">Upload a Custom Parlay</summary>
          <div className="mt-3 rounded-lg border border-panel-border bg-obsidian p-4">
            <ScreenshotIngest kind="ticket" heading="Upload a Custom Parlay" embedded />
            <p className="mt-2 text-xs text-muted">Only use this to upload a screenshot of a custom parlay that cannot be built on SportsLock.</p>
          </div>
        </details>
      ) : null}

      <section>
        <h2 className="font-display text-2xl text-ink">Done</h2>
        {settled.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Hit and Miss land here after you tap.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-md bg-card shadow-[var(--shadow-paper)]">
            {settled.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{t.description}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-500">
                    {t.status === "win" ? "Hit" : t.status === "loss" ? "Miss" : "Push"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {postMortem({
                      selection: t.description,
                      chance: t.chance,
                      status: t.status,
                    })}
                  </p>
                </div>
                <span className={cn("font-mono tabular-nums", (t.pnl ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {formatBetUsd(t.pnl ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm">
        <Link to="/more" hash="words" className="font-medium text-emerald-500 underline-offset-4 hover:underline">
          Words we use
        </Link>
      </p>

      {brier != null ? (
        <p className="text-sm text-muted">
          Rolling Brier (last 50 settled): {brier.toFixed(3)}. Desk pin {DESK_VERSION}. A weak layer's 10% haircut waits
          for the next pin — it does not rewrite tonight. This site never places a bet.
        </p>
      ) : (
        <p className="text-sm text-muted">Brier score shows after eight settled Hit/Miss tickets with a real desk chance. Missing chance stays empty.</p>
      )}
      {haircuts.length ? (
        <p className="text-sm text-emerald-500">
          Pending haircut (not live tonight): {haircuts.map((h) => `${h.layerId} ×${h.haircut}`).join(" · ")}.
        </p>
      ) : null}
      <p className="text-xs text-muted">
        This device keeps the log. Signed-in sessions also save to the desk database. Guests never hit those endpoints.
        Download JSON for the Drive backup named sports_lock_ledger.json.
      </p>

      <BankrollTracker />

      <section className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => downloadLedger(paperTickets.map(paperToLedger))}
        >
          Download my bets JSON
        </Button>
        <Button variant="outline" onClick={resetPaper}>
          Clear the log
        </Button>
        <Button variant="danger" onClick={() => setSelfExcluded(!selfExcluded)}>
          {selfExcluded ? "Turn advice back on (this device)" : "Pause all advice on this device"}
        </Button>
        <p className="text-xs text-muted">Clearing the log does not place or cancel anything at {BRAND.venueLive}.</p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  gold,
  up,
  down,
}: {
  label: string;
  value: string;
  note: string;
  gold?: boolean;
  up?: boolean;
  down?: boolean;
}) {
  return (
    <div className="paper-card p-4">
      <p className="stamp text-muted">{label}</p>
      <p
        className={cn(
          "font-display mt-2 text-2xl tabular-nums",
          gold && "text-emerald-500",
          up && "text-up",
          down && "text-down",
          !gold && !up && !down && "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
