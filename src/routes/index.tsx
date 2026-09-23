import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDeskDecision } from "@/lib/market/use-board";
import { SportsLockParlayCard } from "@/components/app/sportslock-parlay-card";
import { AiTopSingles } from "@/components/app/ai-top-singles";
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
      <AiTopSingles rows={scan?.rows || []} />

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
            <div>
              <h2 className="text-lg font-display font-bold text-ink tracking-tight">Gold ticket</h2>
              <p className="text-[11px] text-muted leading-snug mt-0.5 max-w-xl">
                Best value parlay — highest expected return weighing probability, payout, and edge. Still research — this site never places the bet.
              </p>
            </div>
            {gold.length === 0 ? (
              <p className="text-sm text-muted border border-dashed border-amber-400/20 rounded-xl px-4 py-6">
                No gold ticket on this mix. Live games and weak legs stay off this badge.
              </p>
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
