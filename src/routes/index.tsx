import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDeskDecision } from "@/lib/market/use-board";
import { SportsLockParlayCard } from "@/components/app/sportslock-parlay-card";
import { Sparkles, Activity } from "lucide-react";
import { MixFilterBar, SportFilter, SportSeasonNote } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import {
  applyMixFilter,
  applyRibbonSportFilter,
  buildFeedParlays,
  snapshotSports,
  type MixFilter,
} from "@/lib/market/feed-mix";

export const Route = createFileRoute("/")({ component: SportsLockCommandCenter });

function SportsLockCommandCenter() {
  const { picks, snapshot } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const [mixFilter, setMixFilter] = useState<MixFilter>("ALL");

  const feed = buildFeedParlays(picks);
  const liveSports = snapshotSports(snapshot);
  const filtered = applyMixFilter(applyRibbonSportFilter(feed, sportFilter), mixFilter);
  const topParlays = filtered.slice(0, 12);
  const goldCount = topParlays.filter((p: any) => p.feedLane === "gold").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <Sparkles className="size-8 text-primary" />
          SportsLock AI Feed
        </h1>
        <p className="text-muted text-sm">
          Gold ribbon first. Then catalog 2- and 3-leg tickets the engine already ranked. Research, not a lock.
        </p>
      </div>

      <div className="space-y-2">
        <SportFilter sports={liveSports} />
        <MixFilterBar value={mixFilter} onChange={setMixFilter} />
        {topParlays.length > 0 ? (
          <p className="text-[11px] text-muted font-mono">
            {goldCount} gold · {topParlays.length - goldCount} catalog
          </p>
        ) : null}
      </div>

      {topParlays.length === 0 ? (
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topParlays.map((p: any, i: number) => (
            <SportsLockParlayCard key={p.id || i} parlay={p} snapshot={snapshot} />
          ))}
        </div>
      )}
    </div>
  );
}
