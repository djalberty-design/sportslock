import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useDeskDecision } from "@/lib/market/use-board";
import { SportsLockParlayCard } from "@/components/app/sportslock-parlay-card";
import { AiTopSingles } from "@/components/app/ai-top-singles";
import { getAllEnrichedPropsFn } from "@/lib/market/server";
import { Sparkles, Activity, Calendar } from "lucide-react";
import { MixFilterBar, SportFilter, SportSeasonNote } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import { cn, isTodayEt } from "@/lib/utils";
import {
  applyMixFilter,
  applyRibbonSportFilter,
  applySlateDayFilter,
  buildFeedParlays,
  snapshotSports,
  ribbonLegs,
  type MixFilter,
} from "@/lib/market/feed-mix";
import { enumerateCrossParlays, enumerateSgp } from "@/lib/market/engine";
import { fromParlay } from "@/lib/market/picks";

export const Route = createFileRoute("/")({ component: SportsLockCommandCenter });

function isPickToday(pick: any, snapshot: any): boolean {
  const legs = ribbonLegs(pick);
  if (!legs.length) {
    const start = pick?.row?.start || pick?.start;
    return isTodayEt(start) || Boolean(pick?.row?.inPlay || pick?.inPlay);
  }
  return legs.every((leg: any) => {
    if (leg?.inPlay) return true;
    const rawId = (leg?.eventId || "").replace(/^oddsapi-[A-Z]+-/, "");
    const start = leg?.start
      || snapshot?.quotes?.find((q: any) => q.eventId === leg?.eventId || (rawId && q.eventId?.replace(/^oddsapi-[A-Z]+-/, "") === rawId))?.start
      || (snapshot?.briefs?.find((b: any) => b.eventId === leg?.eventId || (rawId && b.eventId?.replace(/^oddsapi-[A-Z]+-/, "") === rawId)) as any)?.start;
    return isTodayEt(start);
  });
}

function SportsLockCommandCenter() {
  const { picks, snapshot, scan } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const [mixFilter, setMixFilter] = useState<MixFilter>("ALL");
  const [todayOnly, setTodayOnly] = useState(false);
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

  const todayFiltered = useMemo(() => {
    if (!todayOnly) return filtered;
    return filtered.filter((p: any) => isPickToday(p, snapshot));
  }, [filtered, todayOnly, snapshot]);

  const singlesRows = useMemo(() => {
    if (!todayOnly) return scan?.rows || [];
    return (scan?.rows || []).filter(r => isTodayEt(r.start) || r.inPlay);
  }, [scan?.rows, todayOnly]);

  const singlesProps = useMemo(() => {
    if (!todayOnly) return cachedProps;
    return cachedProps.filter(p => {
      const rawId = (p.eventId || "").replace(/^oddsapi-[A-Z]+-/, "");
      const start = p.start
        || (p.row as any)?.start
        || snapshot?.quotes?.find((q: any) => q.eventId === p.eventId || (rawId && q.eventId?.replace(/^oddsapi-[A-Z]+-/, "") === rawId))?.start
        || (snapshot?.briefs?.find((b: any) => b.eventId === p.eventId || (rawId && b.eventId?.replace(/^oddsapi-[A-Z]+-/, "") === rawId)) as any)?.start;
      return isTodayEt(start) || p.inPlay;
    });
  }, [cachedProps, todayOnly, snapshot]);

  // Combined pool of today's rows + props for synthesizing today's parlays if standard feed has 0 today-only parlays
  const candidateTodayRows = useMemo(() => {
    const rows = [...singlesRows];
    const seen = new Set(rows.map(r => `${r.eventId}|${r.selection}`));
    for (const p of singlesProps) {
      const key = `${p.eventId}|${p.selection}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        eventId: p.eventId || "prop",
        sport: p.sport || "NFL",
        start: p.start || new Date().toISOString(),
        home: p.home || "",
        away: p.away || "",
        marketType: p.marketType || "prop",
        side: p.side || "",
        selection: p.selection || `${p.player} Prop`,
        price: p.price || -110,
        fairProb: Number(p.aiProb ?? p.fairProb ?? 0.55),
        evPct: Number(p.aiEdge ?? p.edge ?? 0.05),
        isProp: true,
        player: p.player,
        headshot: p.headshot,
        homeLogo: p.homeLogo,
        awayLogo: p.awayLogo,
        homeAbbr: p.homeAbbr,
        awayAbbr: p.awayAbbr,
        tag: "fair_or_better",
        action: "enter_ticket",
        conviction: "high",
      } as any);
    }
    return rows;
  }, [singlesRows, singlesProps]);

  const fallbackTodayParlays = useMemo(() => {
    if (!todayOnly || todayFiltered.length > 0 || candidateTodayRows.length < 2) return [];
    try {
      const sgps = enumerateSgp(candidateTodayRows, 6);
      const cross2 = enumerateCrossParlays(candidateTodayRows, 2, 6);
      const sgpPicks = sgps.map(p => fromParlay(p, "sgp"));
      const twoPicks = cross2.map(p => fromParlay(p, p.sameGame ? "sgp" : "parlay2"));
      const combined = [...sgpPicks, ...twoPicks];
      if (combined.length === 0) return [];
      return buildFeedParlays({
        ribbon: combined,
        two: twoPicks,
        sgp: sgpPicks,
      });
    } catch (e) {
      console.error("Failed to build fallback today parlays:", e);
      return [];
    }
  }, [todayOnly, todayFiltered.length, candidateTodayRows]);

  const displayParlays = useMemo(() => {
    if (!todayOnly) return filtered;
    if (todayFiltered.length > 0) return todayFiltered;
    return fallbackTodayParlays;
  }, [todayOnly, filtered, todayFiltered, fallbackTodayParlays]);

  let gold = displayParlays.filter((p: any) => p.feedLane === "gold");
  let catalog = displayParlays.filter((p: any) => p.feedLane !== "gold");
  if (gold.length === 0 && catalog.length > 0) {
    gold = [{ ...catalog[0], feedLane: "gold" }];
    catalog = catalog.slice(1);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-full overflow-x-hidden pt-4 sm:pt-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-2.5 sm:gap-3">
          <Sparkles className="size-7 sm:size-8 text-primary shrink-0" />
          <span>SportsLock AI Feed</span>
        </h1>
        <p className="text-muted text-xs sm:text-sm">Top value picks ranked by probability, payout, and edge. Gold is the best bet on the board. Research, not a lock.</p>
      </div>
      <div className="space-y-2">
        <SportFilter sports={liveSports} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex-1 min-w-[240px]">
            <MixFilterBar value={mixFilter} onChange={setMixFilter} />
          </div>
          <button
            type="button"
            onClick={() => setTodayOnly(!todayOnly)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 shadow-sm",
              todayOnly
                ? "bg-amber-400 text-obsidian border-amber-400 font-extrabold shadow-amber-400/20"
                : "bg-panel text-muted border-line hover:text-ink hover:border-amber-400/40"
            )}
            title="Filter AI Picks and Top Singles strictly to today's games in Eastern Time"
          >
            <Calendar className="size-3.5" />
            <span>Today's Games Only</span>
            {todayOnly && <span className="size-1.5 rounded-full bg-obsidian animate-pulse" />}
          </button>
        </div>
      </div>
      {/* ── TOP AI SINGLE BETS SHOWCASE ── */}
      <AiTopSingles rows={singlesRows} cachedProps={singlesProps} />

      {gold.length === 0 && catalog.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-line rounded-xl">
          <Activity className="size-8 text-muted mb-3" />
          <p className="text-ink font-medium">
            {todayOnly ? "No ranked parlays found for today's games only." : "No ranked parlays on this mix."}
          </p>
          <p className="text-muted text-sm mt-1">
            {todayOnly
              ? "Toggle off 'Today's Games Only' to see upcoming slates, or clear the sport filter."
              : "Wait for more pregame mains, or clear the sport filter."}
          </p>
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
                    <span className="text-amber-400">★</span> Gold Ticket
                  </h2>
                  <span className="text-[10px] font-mono uppercase bg-amber-400/15 text-amber-900 dark:text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded-full font-bold">
                    Highest Quant Standard
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-snug mt-0.5 max-w-xl">
                  Best value parlay on the board — highest positive EV (+EV) weighing probability, payout, and market edge. Research, not a lock.
                </p>
              </div>
            </div>
            {gold.length === 0 ? (
              <div className="border border-dashed border-amber-400/30 bg-amber-400/[0.05] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
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
