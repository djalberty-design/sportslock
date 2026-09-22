import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, Star, TrendingUp, Plus, Check, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getAllEnrichedPropsFn } from "@/lib/market/server";
import { formatAmerican } from "@/lib/market/hit-pct";
import { labScore, type LabScore } from "@/lib/market/ev-score";
import { useParlaySlip, isLegSelected } from "@/lib/parlay-slip";
import { resolveTeamLogo } from "@/lib/market/logos";

export const Route = createFileRoute("/picks")({
  component: TheLab,
});

/* ── Tab / sort / filter constants ──────────────────────── */

type BetTab = "all" | "lines" | "props" | "periods";
type SortMode = "ev" | "hit" | "payout" | "time";

const TAB_LABELS: { key: BetTab; label: string }[] = [
  { key: "all", label: "All Bets" },
  { key: "lines", label: "Game Lines" },
  { key: "props", label: "Player Props" },
  { key: "periods", label: "Periods" },
];

const SORT_OPTIONS: { key: SortMode; label: string; icon: any }[] = [
  { key: "ev", label: "EV Score", icon: TrendingUp },
  { key: "hit", label: "Hit %", icon: Target },
  { key: "payout", label: "Payout", icon: Zap },
  { key: "time", label: "Game Time", icon: Clock },
];

const STAR_FILTERS = [
  { key: 0, label: "All" },
  { key: 3, label: "3+ ★" },
  { key: 4, label: "4+ ★" },
  { key: 5, label: "5 ★" },
];

/* ── Unified bet type ───────────────────────────────────── */

interface LabBet {
  id: string;
  selection: string;
  marketType: string;
  sport: string;
  eventId: string;
  home: string;
  away: string;
  start: string;
  price: number;
  player?: string;
  headshot?: string;
  team?: string;
  position?: string;
  side?: string;
  point?: number;
  chance: number;
  fairProb: number;
  inPlay: boolean;
  lab: LabScore;
  isGameLine: boolean;
  isProp: boolean;
  isPeriod: boolean;
  homeLogo?: string;
  awayLogo?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  source: "scan" | "cache";
}

/* ── Helpers ────────────────────────────────────────────── */

function betCategory(b: LabBet): BetTab {
  if (b.isProp) return "props";
  if (b.isPeriod) return "periods";
  return "lines";
}

function marketLabel(mkt: string): string {
  if (mkt === "ml") return "Moneyline";
  if (mkt === "spread") return "Spread";
  if (mkt === "total") return "Total";
  if (mkt === "prop") return "Prop";
  return mkt.replace(/^player_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function renderStars(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("size-3", i < n ? "text-amber-400 fill-amber-400" : "text-line/40")} />
  ));
}

/* ── Component ──────────────────────────────────────────── */

function TheLab() {
  const { picks, scan } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const { legs: sgpSlip, addLeg, removeLeg } = useParlaySlip();

  // Load enriched props from DB
  const [cachedProps, setCachedProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getAllEnrichedPropsFn()
      .then((res) => { if (res.ok && res.props) setCachedProps(res.props); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter & sort state
  const [tab, setTab] = useState<BetTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("ev");
  const [minStars, setMinStars] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Build unified bet pool from scan rows + cached props
  const allBets: LabBet[] = useMemo(() => {
    const seen = new Set<string>();
    const result: LabBet[] = [];

    const dedupKey = (b: any) => `${b.eventId || ""}|${b.marketType || ""}|${b.selection || ""}|${b.side || ""}`;

    // Build a map of eventId → start time and a set of known-live events from the scan
    const now = Date.now();
    const eventStartMap = new Map<string, string>();
    const liveEventIds = new Set<string>();
    const liveMatchups = new Set<string>(); // "away|home" for cross-format matching
    const rows = scan?.rows || [];
    for (const r of rows) {
      if (r.eventId && r.start && !eventStartMap.has(r.eventId)) {
        eventStartMap.set(r.eventId, r.start);
      }
      // Mark event as live if inPlay OR start is in the past
      if (r.eventId) {
        const started = r.inPlay || (r.start && new Date(r.start).getTime() < now);
        if (started) {
          liveEventIds.add(r.eventId);
          // Also track by matchup names for cross-format matching
          if (r.home && r.away) liveMatchups.add(`${r.away.toLowerCase()}|${r.home.toLowerCase()}`);
        }
      }
    }

    // A bet is "live" if inPlay, start is in the past, event is live, or matchup is live
    const isLive = (b: any) => {
      if (b.inPlay) return true;
      if (b.eventId && liveEventIds.has(b.eventId)) return true;
      // Cross-format: match by team names
      if (b.home && b.away && liveMatchups.has(`${b.away.toLowerCase()}|${b.home.toLowerCase()}`)) return true;
      const startStr = b.start || eventStartMap.get(b.eventId || "");
      if (startStr) {
        const start = new Date(startStr).getTime();
        if (!isNaN(start) && start < now) return true;
      }
      return false;
    };

    // 1. Scan rows (game lines + period + any props from the scan)
    for (const r of rows) {
      if (isLive(r)) continue; // pregame only
      const key = dedupKey(r);
      if (seen.has(key)) continue;
      seen.add(key);
      const chance = r.fairProb ?? r.chance ?? 0.5;
      const price = r.price || -110;
      const isProp = !!(r.isProp || r.marketType === "prop" || (r.marketType || "").startsWith("player_"));
      const isPeriod = !isProp && /^(1st|2nd|3rd|first|second|third)/i.test(r.selection || "");
      const lab = labScore({ chance, fairProb: r.fairProb ?? chance, price });
      result.push({
        id: key,
        selection: r.selection || "",
        marketType: r.marketType || "ml",
        sport: r.sport || "",
        eventId: r.eventId || "",
        home: r.home || "",
        away: r.away || "",
        start: r.start || "",
        price,
        player: r.player,
        headshot: r.headshot,
        team: r.team,
        position: r.position,
        side: r.side,
        point: r.point,
        chance,
        fairProb: r.fairProb ?? chance,
        inPlay: !!r.inPlay,
        lab,
        isGameLine: !isProp && !isPeriod,
        isProp,
        isPeriod,
        homeLogo: r.homeLogo,
        awayLogo: r.awayLogo,
        homeAbbr: r.homeAbbr,
        awayAbbr: r.awayAbbr,
        source: "scan",
      });
    }

    // 2. Cached enriched props (from admin pulls) — filter out live events
    for (const p of cachedProps) {
      if (isLive(p)) continue; // pregame only (cross-references scan for start times)
      const key = dedupKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      const chance = p.aiProb ?? p.fairProb ?? p.chance ?? 0.5;
      const price = p.price || -110;
      const lab = labScore({ chance, fairProb: p.fairProb ?? chance, price });
      result.push({
        id: key,
        selection: p.selection || "",
        marketType: p.marketType || "prop",
        sport: p.sport || "",
        eventId: p.eventId || "",
        home: p.home || "",
        away: p.away || "",
        start: p.start || eventStartMap.get(p.eventId || "") || "",
        price,
        player: p.player,
        headshot: p.headshot || (p.row as any)?.headshot,
        team: p.team,
        position: p.position,
        side: p.side,
        point: p.point,
        chance,
        fairProb: p.fairProb ?? chance,
        inPlay: false,
        lab,
        isGameLine: false,
        isProp: true,
        isPeriod: false,
        source: "cache",
      });
    }

    return result;
  }, [scan?.rows, cachedProps]);

  // Apply sport filter (handles "ALL" correctly)
  const sportFiltered = useMemo(() => {
    return applySportFilter(allBets, sportFilter);
  }, [allBets, sportFilter]);

  // Available sports
  const liveSports = useMemo(() =>
    [...new Set(allBets.map(b => b.sport).filter(Boolean))],
    [allBets]
  );

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: sportFiltered.length, lines: 0, props: 0, periods: 0 };
    for (const b of sportFiltered) {
      if (b.isGameLine) counts.lines++;
      else if (b.isProp) counts.props++;
      else if (b.isPeriod) counts.periods++;
    }
    return counts;
  }, [sportFiltered]);

  // Filter + sort
  const displayBets = useMemo(() => {
    let items = sportFiltered;

    // Tab filter
    if (tab !== "all") {
      items = items.filter(b => betCategory(b) === tab);
    }

    // Star filter
    if (minStars > 0) {
      items = items.filter(b => b.lab.stars >= minStars);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(b =>
        (b.player || "").toLowerCase().includes(q) ||
        b.selection.toLowerCase().includes(q) ||
        b.home.toLowerCase().includes(q) ||
        b.away.toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...items].sort((a, b) => {
      switch (sortMode) {
        case "ev": return b.lab.ev - a.lab.ev || b.lab.hitPct - a.lab.hitPct;
        case "hit": return b.lab.hitPct - a.lab.hitPct || b.lab.ev - a.lab.ev;
        case "payout": {
          const aDec = a.price >= 100 ? a.price / 100 + 1 : 100 / Math.abs(a.price) + 1;
          const bDec = b.price >= 100 ? b.price / 100 + 1 : 100 / Math.abs(b.price) + 1;
          return bDec - aDec || b.lab.ev - a.lab.ev;
        }
        case "time": return new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime() || b.lab.ev - a.lab.ev;
        default: return 0;
      }
    });

    return sorted;
  }, [sportFiltered, tab, minStars, searchQuery, sortMode]);

  // Add-to-parlay handler
  const toggleLeg = useCallback((b: LabBet) => {
    const mkt = b.marketType || "unknown";
    if (isLegSelected(sgpSlip, b.selection, mkt)) {
      removeLeg(b.selection, mkt);
    } else {
      addLeg({
        eventId: b.eventId,
        selection: b.selection,
        marketType: mkt,
        side: b.side,
        point: b.point,
        price: b.price,
        fairProb: b.lab.hitPct / 100,
        sport: b.sport,
        home: b.home,
        away: b.away,
        player: b.player,
      });
    }
  }, [sgpSlip, addLeg, removeLeg]);

  const isInSlip = (b: LabBet) => isLegSelected(sgpSlip, b.selection, b.marketType || "unknown");

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          The Lab <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 tracking-normal uppercase">Build Your Parlay</span>
        </h1>
        <p className="text-sm text-muted">
          Every pregame bet ranked by Expected Value. Higher EV = AI thinks it has better value vs the book.
          {allBets.length > 0 && <span className="text-primary font-bold ml-1">{allBets.length} bets analyzed</span>}
        </p>
      </div>

      {/* Sport Filter */}
      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center p-10 text-muted">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          Analyzing all bets...
        </div>
      )}

      {!loading && allBets.length > 0 && (
        <div className="flex flex-col gap-3 pb-24">
          {/* Filter bar */}
          <div className="flex flex-col gap-2 sticky top-7 z-20 bg-background/95 backdrop-blur py-2 -mx-1 px-1">
            {/* Row 1: Bet type tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {TAB_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border shrink-0",
                    tab === key ? "bg-primary text-primary-foreground border-primary" : "bg-panel border-line text-muted hover:border-primary/30"
                  )}
                >
                  {label} ({tabCounts[key]})
                </button>
              ))}
            </div>

            {/* Row 2: Star filter + Sort + Search */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Star filter */}
              <div className="flex rounded-lg border border-line overflow-hidden shrink-0">
                {STAR_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMinStars(key)}
                    className={cn("px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                      minStars === key ? "bg-amber-400/20 text-amber-400" : "bg-panel text-muted hover:bg-line/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex rounded-lg border border-line overflow-hidden shrink-0">
                {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSortMode(key)}
                    className={cn("px-2.5 py-1.5 text-[10px] font-bold transition-colors flex items-center gap-1",
                      sortMode === key ? "bg-primary/20 text-primary" : "bg-panel text-muted hover:bg-line/50"
                    )}
                  >
                    <Icon className="size-3" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Search player or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[120px] bg-panel border border-line rounded-lg px-3 py-1.5 text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-wider px-1">
            <span>{displayBets.length} bet{displayBets.length !== 1 ? "s" : ""} · Sorted by {SORT_OPTIONS.find(s => s.key === sortMode)?.label}</span>
            <span className="text-[9px] text-muted/60">Pregame only · EV = (Hit% × Payout) − 1</span>
          </div>

          {/* Bet cards */}
          <div className="flex flex-col gap-2">
            {displayBets.map((b) => {
              const selected = isInSlip(b);
              const amOdds = formatAmerican(b.price) || `${b.price}`;
              const playerName = b.player;
              const isGameLine = b.isGameLine;
              const stars = b.lab.stars;
              const matchup = `${b.away} @ ${b.home}`;
              const startTime = b.start ? new Date(b.start).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "";
              const sportLabel = (b.sport || "").replace("americanfootball_", "").replace("icehockey_", "").replace("baseball_", "").replace("basketball_", "").toUpperCase();

              // For game lines, show team name. For props, show player.
              const displayName = playerName || b.selection;
              const subtitle = playerName
                ? b.selection.replace(playerName, "").replace(/\s*(passing yards|rushing yards|receiving yards|receptions|passing touchdowns|rushing attempts|anytime touchdown|2\+ touchdowns|points|rebounds|assists|threes made|points \+ rebounds \+ assists|steals|blocks|hits|total bases|home run|rbi|strikeouts|walks|stolen bases|shots on goal|goals|saves|blocked shots|pass yds|rush yds|rec yds|pass tds?|rush att)$/i, "").trim()
                : isGameLine ? marketLabel(b.marketType) : "";
              const initials = playerName ? playerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";

              return (
                <div key={b.id} className={cn(
                  "rounded-xl border bg-panel p-3 transition-all",
                  selected ? "border-primary ring-1 ring-primary/30" : "border-line hover:border-primary/30",
                  stars >= 4 ? "border-l-4 border-l-amber-400" : "",
                  b.lab.ev < 0 ? "opacity-60" : ""
                )}>
                  <div className="flex items-center gap-3">
                    {/* Stars + Avatar */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      {(() => {
                        // 1. Player headshot (props)
                        if (b.headshot) return <img src={b.headshot} className="size-10 rounded-full object-cover ring-2 ring-line bg-obsidian" alt="" />;
                        // 2. Team logo (game lines) — figure out which team is selected
                        if (!playerName) {
                          const sel = (b.selection || "").toLowerCase();
                          const isHome = b.home && sel.includes(b.home.toLowerCase().split(" ").pop() || "");
                          const isAway = !isHome && b.away && sel.includes(b.away.toLowerCase().split(" ").pop() || "");
                          const logoUrl = isHome
                            ? (b.homeLogo || resolveTeamLogo(b.sport, { abbr: b.homeAbbr, name: b.home }))
                            : isAway
                            ? (b.awayLogo || resolveTeamLogo(b.sport, { abbr: b.awayAbbr, name: b.away }))
                            : (b.homeLogo || resolveTeamLogo(b.sport, { abbr: b.homeAbbr, name: b.home }));
                          if (logoUrl) return <img src={logoUrl} className="size-10 rounded-full object-contain bg-obsidian ring-2 ring-line p-1" alt="" />;
                        }
                        // 3. Initials fallback (props without headshot)
                        if (initials) return (
                          <div className="size-10 rounded-full bg-line ring-2 ring-primary/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-muted">{initials}</span>
                          </div>
                        );
                        // 4. Icon fallback
                        return (
                          <div className="size-10 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center">
                            <Target className="size-4 text-primary" />
                          </div>
                        );
                      })()}
                      <div className="flex gap-px">{renderStars(stars)}</div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink truncate">{displayName}</span>
                        {b.isProp && <span className="text-[8px] bg-violet-500/20 text-violet-400 rounded px-1 font-bold shrink-0">PROP</span>}
                        {b.isPeriod && <span className="text-[8px] bg-sky-500/20 text-sky-400 rounded px-1 font-bold shrink-0">PERIOD</span>}
                        {isGameLine && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 rounded px-1 font-bold shrink-0">{marketLabel(b.marketType).toUpperCase()}</span>}
                      </div>
                      {subtitle && <span className="text-xs text-muted truncate block">{subtitle}</span>}
                      <span className="text-[10px] text-muted/40">{matchup} · {sportLabel} · {startTime}</span>
                    </div>

                    {/* Odds + Add */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center min-w-[60px] h-10 rounded-md border bg-obsidian border-line justify-center">
                        <span className="font-mono text-sm font-bold text-primary">{amOdds}</span>
                      </div>
                      <button
                        onClick={() => toggleLeg(b)}
                        className={cn("size-8 rounded-lg border flex items-center justify-center transition-all",
                          selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-panel border-line text-muted hover:border-primary/50 hover:text-primary"
                        )}
                      >
                        {selected ? <Check className="size-4" /> : <Plus className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Hit bar + EV */}
                  <div className="mt-2 mx-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="flex-1 h-1.5 bg-line/40 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", b.lab.hitPct >= 55 ? "bg-emerald-500" : b.lab.hitPct >= 45 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${b.lab.hitPct}%` }} />
                      </div>
                      <span className={cn("text-xs font-mono font-bold whitespace-nowrap", b.lab.hitPct >= 55 ? "text-emerald-400" : b.lab.hitPct >= 45 ? "text-amber-400" : "text-red-400")}>
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-400 rounded px-1 mr-1 font-bold">AI</span>
                        {b.lab.hitPct}% hit
                      </span>
                      <span className={cn("text-[9px] font-mono px-1 rounded font-bold", b.lab.ev >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                        EV {b.lab.evPct}
                      </span>
                      {parseFloat(b.lab.edgePct) !== 0 && (
                        <span className={cn("text-[9px] font-mono px-1 rounded", parseFloat(b.lab.edgePct) > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                          {b.lab.edgePct} edge
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted italic ml-0.5">
                      {b.lab.label} — {b.lab.hitPct >= 70 ? "wins most of the time" : b.lab.hitPct >= 55 ? "better than a coin flip" : b.lab.hitPct >= 45 ? "could go either way" : b.lab.hitPct >= 30 ? "lower chance, bigger payout" : "risky but high reward"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {displayBets.length === 0 && (
            <div className="text-center p-8 text-muted text-sm border border-dashed border-line rounded-xl">
              No bets match your filters. Try adjusting tabs, stars, or search.
            </div>
          )}
        </div>
      )}

      {!loading && allBets.length === 0 && (
        <div className="text-center p-10 text-muted border border-dashed border-line rounded-xl">
          <Target className="size-8 mx-auto mb-3 opacity-50" />
          <p>No active bets found in The Lab right now.</p>
          <p className="text-xs mt-2 text-muted/60">Bets appear here when the board is live and/or player props have been pulled.</p>
        </div>
      )}
    </div>
  );
}