import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useDeskDecision } from "@/lib/market/use-board";
import { SportsLockParlayCard } from "@/components/app/sportslock-parlay-card";
import { AiTopSingles } from "@/components/app/ai-top-singles";
import { getAllEnrichedPropsFn } from "@/lib/market/server";
import { Sparkles, Activity } from "lucide-react";
import { MixFilterBar, SportFilter, SportSeasonNote } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import {
  applyMixFilter,
  applyRibbonSportFilter,
  applySlateDayFilter,
  buildFeedParlays,
  snapshotSports,
  type MixFilter,
} from "@/lib/market/feed-mix";

export const Route = createFileRoute("/")({ component: SportsLockCommandCenter });

function SportsLockCommandCenter() {
  const { picks, snapshot, scan } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const [mixFilter, setMixFilter] = useState<MixFilter>("ALL");
  const [cachedProps, setCachedProps] = useState<any[]>([]);

  useEffect(() => {
    getAllEnrichedPropsFn()
      .then((res) => { if (res.ok && res.props) setCachedProps(res.props); })
      .catch(() => {});
  }, []);

  const feed = buildFeedParlays(picks);
  const liveSports = snapshotSports(snapshot);
  const filtered = applyMixFilter(
    applyRibbonSportFilter(applySlateDayFilter(feed, snapshot), sportFilter),
    mixFilter,
  );
  const gold = filtered.filter((p: any) => p.feedLane === "gold");
  const catalog = filtered.filter((p: any) => p.feedLane !== "gold");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <Sparkles className="size-8 text-primary" />
          SportsLock AI Feed
        </h1>
        <p className="text-muted text-sm">Top value picks ranked by probability, payout, and edge. Gold is the best bet on the board. Research, not a lock.</p>
      </div>
      <div className="space-y-2">
        <SportFilter sports={liveSports} />
        <MixFilterBar value={mixFilter} onChange={setMixFilter} />
      </div>
      {/* ── TOP AI SINGLE BETS SHOWCASE ── */}
      <AiTopSingles rows={scan?.rows || []} cachedProps={cachedProps} />

      {gold.length === 0 && catalog.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-line rounded-xl">
          <Activity className="size-8 text-muted mb-3" />
          <p className="text-ink font-medium">No ranked parlays on this mix.</p>
          <p className="text-muted text-sm mt-1">Wait for more pregame mains, or clear the sport filter.</p>
          {sportFilter && sportFilter !== "ALL" ? (
            <div className="mt-4 max-w-lg text-left">
              <SportSeasonNote sport={sportFilter} />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-display font-bold text-ink tracking-tight flex items-center gap-1.5">
                    <span className="text-amber-500 dark:text-amber-400">★</span> Gold Ticket
                  </h2>
                  <span className="text-[10px] font-mono uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-600/30 dark:border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                    Highest Quant Standard
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-snug mt-0.5 max-w-xl">
                  Best value parlay on the board — highest positive EV (+EV) weighing probability, payout, and market edge. Research, not a lock.
                </p>
              </div>
            </div>
            {gold.length === 0 ? (
              <div className="border border-dashed border-amber-600/30 dark:border-amber-400/20 bg-amber-500/[0.04] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <span className="text-base">🛡️</span> Why is there no Gold Ticket on this slate?
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  SportsLock’s <strong>Gold Ticket</strong> badge is intentionally selective. To protect bankroll, our AI only awards the Gold Badge when a parlay satisfies every single quality standard:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted">
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Positive Quant EV (+EV)</strong>: Higher true win probability than Vegas implied odds.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Pregame Only</strong>: In-progress live games are barred to avoid stale lines.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>No Extreme Chalk</strong>: No individual leg or parlay heavier than -400.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Balanced Hit Window (35%–85%)</strong>: No low-probability lottery bets or zero-edge juice traps.</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted/80 italic pt-1 border-t border-line/40">
                  When the current slate has no ticket meeting every standard, the AI deliberately shows none rather than recommending a subpar bet. Check the Catalog below or check back as lineups and odds update!
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {gold.map((p: any, i: number) => (
                  <SportsLockParlayCard key={p.id || i} parlay={p} snapshot={snapshot} />
                ))}
              </div>
            )}
          </section>
          <section className="space-y-3 pt-2">
            <div>
              <h2 className="text-lg font-display font-bold text-ink tracking-tight">Catalog{catalog.length ? ` · ${catalog.length}` : ""}</h2>
              <p className="text-[11px] text-muted leading-snug mt-0.5 max-w-xl">
                Every other ranked 2- and 3-leg on this mix. Weaker floors than gold. Photograph Hard Rock before you fill.
              </p>
            </div>
            {catalog.length === 0 ? (
              <p className="text-sm text-muted border border-dashed border-line rounded-xl px-4 py-6">No catalog parlays on this mix.</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {catalog.map((p: any, i: number) => (
                  <SportsLockParlayCard key={p.id || i} parlay={p} snapshot={snapshot} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
