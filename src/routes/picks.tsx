import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, BarChart2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import { useState, useEffect, useMemo } from "react";
import { getAllEnrichedPropsFn } from "@/lib/market/server";
import { ticketHitPct } from "@/lib/market/hit-pct";

export const Route = createFileRoute("/picks")({
  component: TheLab,
});

// Same label/order maps as game-page.tsx
const PROP_LABEL: Record<string, string> = {
  player_anytime_td: "🏈 Anytime Touchdown",
  player_pass_tds: "🎯 Passing Touchdowns",
  player_pass_yds: "📊 Passing Yards",
  player_rush_yds: "🏃 Rushing Yards",
  player_reception_yds: "🤲 Receiving Yards",
  player_rec_yds: "🤲 Receiving Yards",
  player_receptions: "🤲 Receptions",
  player_rush_att: "🏃 Rushing Attempts",
  player_rush_attempts: "🏃 Rushing Attempts",
  player_points: "🏀 Points",
  player_rebounds: "🏀 Rebounds",
  player_assists: "🏀 Assists",
  player_threes: "🏀 Three-Pointers",
  player_home_runs: "⚾ Home Runs",
  player_hr: "⚾ Home Runs",
  player_strikeouts: "⚾ Strikeouts",
  player_ks: "⚾ Strikeouts",
  player_hits: "⚾ Hits",
  player_total_bases: "⚾ Total Bases",
  player_goals: "🏒 Goals",
  player_shots_on_goal: "🏒 Shots on Goal",
  player_saves: "🏒 Saves",
  player_blocked_shots: "🏒 Blocked Shots",
};

const PROP_ORDER: string[] = [
  "player_anytime_td", "player_pass_tds", "player_pass_yds",
  "player_rush_yds", "player_reception_yds", "player_rec_yds", "player_receptions",
  "player_rush_att", "player_rush_attempts",
  "player_points", "player_rebounds", "player_assists", "player_threes",
  "player_home_runs", "player_hr", "player_strikeouts", "player_ks",
  "player_hits", "player_total_bases",
  "player_goals", "player_shots_on_goal", "player_saves", "player_blocked_shots",
];

function TheLab() {
  const { picks } = useDeskDecision();
  const scanProps = picks?.props || [];
  const sportFilter = useDeskStore((s) => s.sportFilter);

  // Load all enriched props from DB cache
  const [cachedProps, setCachedProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getAllEnrichedPropsFn()
      .then((res) => { if (res.ok && res.props) setCachedProps(res.props); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge cached + scan props (deduplicate)
  const mergedProps = useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];
    const dedupKey = (p: any) => `${p.eventId || ""}|${p.player || ""}|${p.marketType || ""}|${p.selection || ""}`;
    for (const p of cachedProps) {
      const key = dedupKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    for (const p of scanProps) {
      const key = dedupKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    return result;
  }, [cachedProps, scanProps]);

  const allProps = applySportFilter(mergedProps, sportFilter);
  const liveSports = [...new Set(mergedProps.map((p: any) => p.sport).filter(Boolean))];

  // Filter state (mirrors matchup page)
  const [teamFilter, setTeamFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [propFilter, setPropFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");

  // Get unique games for team toggle
  const games = useMemo(() => {
    const m = new Map<string, { home: string; away: string }>();
    for (const p of allProps) {
      const key = `${p.away}@${p.home}`;
      if (!m.has(key)) m.set(key, { home: p.home, away: p.away });
    }
    return [...m.values()];
  }, [allProps]);

  // Apply filters
  const filtered = useMemo(() => {
    let items = allProps;
    if (teamFilter !== "all") {
      items = items.filter((q: any) => {
        if (q.homeAway) return q.homeAway === teamFilter;
        const pTeam = (q.team || "").toLowerCase();
        if (!pTeam) return false;
        if (teamFilter === "home") return games.some(g => g.home.toLowerCase().includes(pTeam));
        if (teamFilter === "away") return games.some(g => g.away.toLowerCase().includes(pTeam));
        return false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((p: any) => (p.player || "").toLowerCase().includes(q) || (p.selection || "").toLowerCase().includes(q));
    }
    if (propFilter !== "all") {
      items = items.filter((p: any) => p.marketType === propFilter);
    }
    if (confidenceFilter !== "all") {
      items = items.filter((p: any) => (p.confidence || p.row?.confidence || "medium").toLowerCase() === confidenceFilter);
    }
    return items;
  }, [allProps, teamFilter, searchQuery, propFilter, confidenceFilter, games]);

  // Get available categories (pre-filter)
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProps) {
      const cat = p.marketType || "other";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => {
      const ai = PROP_ORDER.indexOf(a);
      const bi = PROP_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [allProps]);

  // Group by category + sort by prediction (highest first)
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const q of filtered) {
      const cat = q.marketType || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(q);
    }
    // Sort within each category by AI prediction (highest first)
    for (const [, arr] of map) {
      arr.sort((a: any, b: any) => {
        const aProb = a.aiProb ?? a.fairProb ?? 0;
        const bProb = b.aiProb ?? b.fairProb ?? 0;
        if (bProb !== aProb) return bProb - aProb;
        return (b.aiEdge || 0) - (a.aiEdge || 0);
      });
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = PROP_ORDER.indexOf(a);
      const bi = PROP_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [filtered]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          The Lab <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 tracking-normal uppercase">AI Picks</span>
        </h1>
        {mergedProps.length > 0 && (
          <p className="text-sm text-muted">{mergedProps.length} player props analyzed · Sorted by highest prediction</p>
        )}
      </div>

      {/* Sport Filter */}
      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center p-10 text-muted">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          Loading AI picks...
        </div>
      )}

      {!loading && allProps.length > 0 && (
        <div className="flex flex-col gap-3 pb-24">
          {/* Filter bar — mirrors matchup page */}
          <div className="flex flex-col gap-2 sticky top-7 z-20 bg-background/95 backdrop-blur py-2 -mx-1 px-1">
            {/* Row 1: Team toggle + Search */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-line overflow-hidden shrink-0">
                {[
                  { key: "all", label: "Both" },
                  { key: "away", label: "Away" },
                  { key: "home", label: "Home" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTeamFilter(key)}
                    className={cn("px-3 py-1.5 text-[11px] font-bold transition-colors",
                      teamFilter === key ? "bg-primary text-primary-foreground" : "bg-panel text-muted hover:bg-line/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-panel border border-line rounded-lg px-3 py-1.5 text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
              />
            </div>
            {/* Row 2: Confidence filter */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { key: "all", label: "All Confidence" },
                { key: "high", label: "High" },
                { key: "medium", label: "Medium" },
                { key: "low", label: "Low" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setConfidenceFilter(key)}
                  className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border shrink-0 flex items-center gap-1",
                    confidenceFilter === key ? "bg-amber-400/10 text-amber-400 border-amber-400/30" : "bg-panel border-line text-muted hover:border-amber-400/30"
                  )}
                >
                  {key === "high" && <Star className={cn("size-3", confidenceFilter === "high" ? "fill-amber-400" : "")} />}
                  {label}
                </button>
              ))}
            </div>
            {/* Row 3: Category pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setPropFilter("all")}
                className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border shrink-0",
                  propFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-panel border-line text-muted hover:border-primary/30"
                )}
              >
                All ({allProps.length})
              </button>
              {availableCategories.map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setPropFilter(propFilter === cat ? "all" : cat)}
                  className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border shrink-0",
                    propFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-panel border-line text-muted hover:border-primary/30"
                  )}
                >
                  {PROP_LABEL[cat]?.replace(/^[^\s]+\s/, "") || cat.replace(/^player_/, "").replace(/_/g, " ")} ({count})
                </button>
              ))}
            </div>
          </div>

          {/* Grouped sections */}
          {grouped.map(([cat, catItems]) => (
            <div key={cat} className="flex flex-col gap-2">
              <div className="sticky top-[96px] z-10 bg-background/95 backdrop-blur px-1 py-2 border-b border-line/30">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {PROP_LABEL[cat] || cat.replace(/^player_/, "").replace(/_/g, " ")} <span className="text-muted font-normal ml-1">({catItems.length})</span>
                </h3>
              </div>
              {catItems.map((p: any, i: number) => {
                const playerName = p.player || p.row?.player;
                const label = playerName ? p.selection.replace(playerName, "").trim() : p.selection;
                // Strip stat label from display
                const cleanLabel = label
                  .replace(/\s*(passing yards|rushing yards|receiving yards|receptions|passing touchdowns|rushing attempts|anytime touchdown|2\+ touchdowns|points|rebounds|assists|threes made|points \+ rebounds \+ assists|steals|blocks|hits|total bases|home run|rbi|strikeouts|walks|stolen bases|shots on goal|goals|saves|blocked shots|pass yds|rush yds|rec yds|pass tds?|rush att)$/i, "")
                  .trim();
                const headshotUrl = p.headshot || (p.row as any)?.headshot;
                const teamPos = [p.team, p.position].filter(Boolean).join(" · ");
                const rawAi = p.aiProb ?? p.fairProb ?? null;
                const probPct = ticketHitPct({ chance: p.chance ?? rawAi, fairProb: p.fairProb ?? rawAi, price: p.price }) ?? Math.round((rawAi ?? 0.5) * 100);
                const hasAi = p.aiProb != null;
                const rawP = p.price || -110;
                const implied = rawP < 0 ? Math.abs(rawP) / (Math.abs(rawP) + 100) : 100 / (rawP + 100);
                const edgeVal = p.aiEdge ? p.aiEdge * 100 : ((probPct / 100 - implied) * 100);
                const edgePct = edgeVal.toFixed(1);
                const amOdds = rawP > 0 ? `+${rawP}` : `${rawP}`;
                const initials = playerName ? playerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";

                const confidence = (p.confidence || p.row?.confidence || "medium").toLowerCase();
                const isHigh = confidence === "high";
                const isLow = confidence === "low";

                return (
                  <div key={`${p.selection}-${i}`} className={cn(
                    "rounded-xl border border-line bg-panel p-3 hover:border-primary/30 transition-all",
                    isHigh ? "border-l-4 border-l-amber-400" : "",
                    isLow ? "opacity-70" : ""
                  )}>
                    <div className="flex items-center gap-3">
                      {/* Headshot */}
                      {headshotUrl ? (
                        <img src={headshotUrl} className="size-10 rounded-full object-cover ring-2 ring-line bg-obsidian shrink-0" alt={playerName || ""} />
                      ) : initials ? (
                        <div className="size-10 rounded-full bg-line ring-2 ring-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-muted">{initials}</span>
                        </div>
                      ) : (
                        <div className="size-10 rounded-full bg-line ring-2 ring-line flex items-center justify-center shrink-0">
                          <Target className="size-4 text-muted opacity-50" />
                        </div>
                      )}
                      {/* Player info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink truncate flex items-center gap-1">
                            {playerName || p.selection}
                            {isHigh && <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />}
                          </span>
                          {teamPos && <span className="text-[10px] text-muted/50 uppercase tracking-wider shrink-0">{teamPos}</span>}
                        </div>
                        {playerName && <span className="text-xs text-muted truncate block">{cleanLabel}</span>}
                        <span className="text-[10px] text-muted/40">{p.away || ""} @ {p.home || ""}</span>
                      </div>
                      {/* Odds */}
                      <div className="shrink-0">
                        <div className={cn("flex flex-col items-center justify-center min-w-[65px] h-10 rounded-md border transition-colors",
                          "bg-obsidian border-line text-primary"
                        )}>
                          <span className="font-mono text-sm font-bold">{amOdds}</span>
                        </div>
                      </div>
                    </div>
                    {/* AI bar */}
                    <div className="mt-2 mx-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="flex-1 h-1.5 bg-line/40 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-500", probPct >= 55 ? "bg-emerald-500" : probPct >= 45 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${probPct}%` }} />
                        </div>
                        <span className={cn("text-xs font-mono font-bold whitespace-nowrap", probPct >= 55 ? "text-emerald-400" : probPct >= 45 ? "text-amber-400" : "text-red-400")}>
                          {hasAi && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 rounded px-1 mr-1 font-bold">AI</span>}
                          {probPct}% hit
                        </span>
                        {parseFloat(edgePct) !== 0 && (
                          <span className={cn("text-[9px] font-mono px-1 rounded", parseFloat(edgePct) > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                            {parseFloat(edgePct) > 0 ? "+" : ""}{edgePct}% edge
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted italic ml-0.5">
                        {probPct >= 70 ? "Strong favorite — wins most of the time" : probPct >= 55 ? "Slight edge — better than a coin flip" : probPct >= 45 ? "Close to a toss-up — could go either way" : probPct >= 30 ? "Underdog — lower chance, bigger payout" : "Long shot — risky but high reward"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center p-8 text-muted text-sm border border-dashed border-line rounded-xl">
              No props match your filters. Try adjusting team or category.
            </div>
          )}
        </div>
      )}

      {!loading && allProps.length === 0 && (
        <div className="text-center p-10 text-muted border border-dashed border-line rounded-xl">
          <Target className="size-8 mx-auto mb-3 opacity-50" />
          <p>No active props found in The Lab right now.</p>
          <p className="text-xs mt-2 text-muted/60">Pull player props from a game's matchup page to populate AI picks here.</p>
        </div>
      )}
    </div>
  );
}