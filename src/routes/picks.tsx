import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, Star, TrendingUp, Plus, Check, Clock, Zap, Flame, User, Layers, Sparkles, ChevronDown, ChevronUp, Activity, Bot, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatEasternShort, isTodayEt } from "@/lib/utils";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getAllEnrichedPropsFn } from "@/lib/market/server";
import { formatAmerican } from "@/lib/market/hit-pct";
import { labScore, type LabScore } from "@/lib/market/ev-score";
import { useParlaySlip, isLegSelected } from "@/lib/parlay-slip";
import { resolveTeamLogo, resolveLegTeam, resolvePlayerHeadshotSync, fetchPlayerHeadshot } from "@/lib/market/logos";
import { AiCustomArchitect } from "@/components/app/ai-custom-architect";
import { calculateDynamicWager } from "@/lib/kelly";
import { DistributionChart } from "@/components/quant/distribution-chart";
import { AiAnalystDrawer } from "@/components/app/ai-analyst-drawer";

export const Route = createFileRoute("/picks")({
  component: TheLab,
});

/* ── Tab / sort / filter constants ──────────────────────── */

type BetTab = "all" | "lines" | "props" | "periods";
type ModelFilter = "all" | "sim" | "prop" | "sharp" | "period";
type SortMode = "ev" | "edge" | "hit" | "payout" | "time";

const TAB_LABELS: { key: BetTab; label: string }[] = [
  { key: "all", label: "All Bets" },
  { key: "lines", label: "Game Lines" },
  { key: "props", label: "Player Props" },
  { key: "periods", label: "Periods" },
];

const MODEL_FILTERS: { key: ModelFilter; label: string; icon: string }[] = [
  { key: "all", label: "All Models", icon: "🧠" },
  { key: "sim", label: "SIM (10k Sim)", icon: "⚡" },
  { key: "prop", label: "PROP (Player Labs)", icon: "👤" },
  { key: "sharp", label: "SHARP (Steam/RLM)", icon: "📈" },
  { key: "period", label: "PERIOD (1H/1P)", icon: "⏱️" },
];

const SORT_OPTIONS: { key: SortMode; label: string; icon: any }[] = [
  { key: "ev", label: "EV Score", icon: TrendingUp },
  { key: "edge", label: "Edge %", icon: Target },
  { key: "hit", label: "Hit %", icon: Zap },
  { key: "payout", label: "Payout", icon: Flame },
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
  modelType: "sim" | "prop" | "sharp" | "period";
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

function formatPropLabel(b: LabBet): string {
  const mkt = String(b.marketType || "").toLowerCase();
  const rawSel = String(b.selection || "");
  const player = String(b.player || "");

  // 1. Anytime Touchdown
  if (mkt.includes("anytime_td") || mkt.includes("touchdown") || /anytime\s*touchdown/i.test(rawSel) || /to score a touchdown/i.test(rawSel)) {
    return "Anytime Touchdown";
  }

  // 2. 2+ Touchdowns
  if (mkt.includes("2_or_more_td") || /2\+\s*touchdowns/i.test(rawSel)) {
    return "2+ Touchdowns";
  }

  // 3. First Touchdown
  if (mkt.includes("first_td") || /first\s*touchdown/i.test(rawSel)) {
    return "First Touchdown";
  }

  // Clean selection by removing the player's name if present
  let cleanSel = rawSel;
  if (player && cleanSel.toLowerCase().includes(player.toLowerCase())) {
    cleanSel = cleanSel.replace(new RegExp(player, "i"), "").trim();
  }

  // If selection starts with "Yes " or "No "
  cleanSel = cleanSel.replace(/^(yes|no)\s+/i, "").trim();

  // If cleanSel already has "Over X.X Stat" or "Under X.X Stat"
  if (/^(over|under)\s+\d+(\.\d+)?\s+[a-z]/i.test(cleanSel)) {
    return cleanSel.replace(/\b\w/g, c => c.toUpperCase());
  }

  // If cleanSel is just "Over X.X" or "Under X.X" (or side + point)
  const readableStat = marketLabel(mkt);
  const side = b.side ? b.side.charAt(0).toUpperCase() + b.side.slice(1).toLowerCase() : "";
  const pt = b.point != null ? b.point : "";

  if (/^(over|under)\s+\d+(\.\d+)?$/i.test(cleanSel)) {
    return `${cleanSel} ${readableStat}`;
  }

  if (side && pt) {
    if (player) {
      return `${side} ${pt} ${readableStat}`;
    }
    const legTeam = resolveLegTeam({
      sport: b.sport,
      home: b.home,
      away: b.away,
      homeAbbr: b.homeAbbr,
      awayAbbr: b.awayAbbr,
      homeLogo: b.homeLogo,
      awayLogo: b.awayLogo,
      selection: b.selection,
      side: b.side,
    });
    const teamName = b.side === "home" ? (legTeam.homeName || b.home) : (legTeam.awayName || b.away);
    const ptText = typeof pt === "number" ? (pt > 0 ? `+${pt}` : `${pt}`) : pt;
    return `${teamName || side} ${ptText}`;
  }

  if (cleanSel && cleanSel.toLowerCase() !== "yes" && cleanSel.toLowerCase() !== "no") {
    return cleanSel;
  }

  return readableStat || "Player Prop";
}

function renderStars(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("size-3", i < n ? "text-amber-400 fill-amber-400" : "text-line/40")} />
  ));
}

/* ── Fallback Avatar Component ──────────────────────────── */

function BetAvatar({
  headshot: initialHeadshot,
  logoUrl,
  initials,
  playerName,
}: {
  headshot?: string;
  logoUrl?: string | null;
  initials?: string;
  playerName?: string;
}) {
  const [headshot, setHeadshot] = useState<string | undefined>(
    initialHeadshot || (playerName ? resolvePlayerHeadshotSync(playerName) || undefined : undefined)
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialHeadshot) {
      setHeadshot(initialHeadshot);
      setError(false);
      return;
    }
    if (playerName) {
      const sync = resolvePlayerHeadshotSync(playerName);
      if (sync) {
        setHeadshot(sync);
        setError(false);
      } else {
        fetchPlayerHeadshot(playerName).then((res) => {
          if (res) {
            setHeadshot(res);
            setError(false);
          }
        }).catch(() => {});
      }
    }
  }, [initialHeadshot, playerName]);

  // For player props (playerName exists), never fall back to team logo
  const src = !error ? (headshot || (!playerName ? logoUrl : null)) : null;

  if (src) {
    return (
      <img
        src={src}
        onError={() => setError(true)}
        className={cn(
          "size-10 rounded-full ring-2 ring-line bg-obsidian transition-opacity",
          headshot ? "object-cover" : "object-contain p-1"
        )}
        alt={playerName || ""}
        loading="lazy"
      />
    );
  }

  if (initials) {
    return (
      <div className="size-10 rounded-full bg-violet-500/10 border border-violet-500/30 ring-2 ring-line flex items-center justify-center">
        <span className="text-xs font-bold text-violet-300 font-mono">{initials}</span>
      </div>
    );
  }

  return (
    <div className="size-10 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center">
      <Target className="size-4 text-primary" />
    </div>
  );
}

/* ── Component ──────────────────────────────────────────── */

function TheLab() {
  const { picks, scan } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const setSportFilter = useDeskStore((s) => s.setSportFilter);
  const totalBankroll = useDeskStore((s) => s.totalBankroll);
  const baseUnitSize = useDeskStore((s) => s.baseUnitSize);
  const riskProfileMode = useDeskStore((s) => s.riskProfileMode);
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
  const [todayOnly, setTodayOnly] = useState(false);
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("ev");
  const [minStars, setMinStars] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBetId, setExpandedBetId] = useState<string | null>(null);
  const [isAnalystOpen, setIsAnalystOpen] = useState(false);

  // Build unified bet pool from scan rows + cached props
  const allBets: LabBet[] = useMemo(() => {
    const seen = new Set<string>();
    const result: LabBet[] = [];

    const dedupKey = (b: any) => `${b.eventId || ""}|${b.marketType || ""}|${b.selection || ""}|${b.side || ""}`;

    // Build map of eventId -> start time and live events
    const now = Date.now();
    const eventStartMap = new Map<string, string>();
    const matchupStartMap = new Map<string, string>();
    const liveEventIds = new Set<string>();
    const liveMatchups = new Set<string>();
    const rows = scan?.rows || [];

    for (const r of rows) {
      if (r.eventId && r.start && !eventStartMap.has(r.eventId)) {
        eventStartMap.set(r.eventId, r.start);
      }
      if (r.home && r.away && r.start) {
        const mKey = `${r.away.toLowerCase()}|${r.home.toLowerCase()}`;
        if (!matchupStartMap.has(mKey)) matchupStartMap.set(mKey, r.start);
      }
      if (r.eventId) {
        const started = r.inPlay || (r.start && new Date(r.start).getTime() < now);
        if (started) {
          liveEventIds.add(r.eventId);
          if (r.home && r.away) liveMatchups.add(`${r.away.toLowerCase()}|${r.home.toLowerCase()}`);
        }
      }
    }

    const isLive = (b: any) => {
      if (b.inPlay) return true;
      const startStr = b.start || (b.eventId ? eventStartMap.get(b.eventId) : undefined);
      if (startStr) {
        const start = new Date(startStr).getTime();
        if (!isNaN(start)) {
          return start < now;
        }
      }
      if (b.eventId && liveEventIds.has(b.eventId)) return true;
      return false;
    };

    // 1. Scan rows (game lines + period + any props from scan)
    for (const r of rows) {
      if (isLive(r)) continue;
      const key = dedupKey(r);
      if (seen.has(key)) continue;
      seen.add(key);

      const chance = r.fairProb ?? r.chance ?? 0.5;
      const price = r.price || -110;
      const isProp = !!(r.isProp || r.marketType === "prop" || (r.marketType || "").startsWith("player_"));
      const isPeriod = !isProp && /^(1st|2nd|3rd|first|second|third)/i.test(r.selection || "");
      const lab = labScore({ chance, fairProb: r.fairProb ?? chance, price });
      const edgeNum = Math.abs(parseFloat(lab.edgePct || "0"));

      let modelType: "sim" | "prop" | "sharp" | "period" = "sim";
      if (isProp) {
        modelType = "prop";
      } else if (isPeriod) {
        modelType = "period";
      } else if (edgeNum >= 3.5 || lab.ev >= 6) {
        modelType = "sharp";
      } else {
        modelType = "sim";
      }

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
        modelType,
        homeLogo: r.homeLogo,
        awayLogo: r.awayLogo,
        homeAbbr: r.homeAbbr,
        awayAbbr: r.awayAbbr,
        source: "scan",
      });
    }

    // 2. Cached enriched props
    for (const p of cachedProps) {
      if (isLive(p)) continue;
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
        modelType: "prop",
        source: "cache",
      });
    }

    return result;
  }, [scan?.rows, cachedProps]);

  // Apply sport filter
  const sportFiltered = useMemo(() => {
    return applySportFilter(allBets, sportFilter);
  }, [allBets, sportFilter]);

  // Available sports and counts across all bets
  const liveSports = useMemo(() =>
    [...new Set(allBets.map(b => b.sport).filter(Boolean))],
    [allBets]
  );

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allBets.length };
    for (const b of allBets) {
      if (b.sport) {
        counts[b.sport] = (counts[b.sport] || 0) + 1;
      }
    }
    return counts;
  }, [allBets]);

  // Today's games filter (calendar date in Eastern Time)
  const todayFiltered = useMemo(() => {
    if (!todayOnly) return sportFiltered;
    return sportFiltered.filter(b => isTodayEt(b.start) || b.inPlay);
  }, [sportFiltered, todayOnly]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: todayFiltered.length, lines: 0, props: 0, periods: 0 };
    for (const b of todayFiltered) {
      if (b.isGameLine) counts.lines++;
      else if (b.isProp) counts.props++;
      else if (b.isPeriod) counts.periods++;
    }
    return counts;
  }, [todayFiltered]);

  // Filter + sort
  const displayBets = useMemo(() => {
    let items = todayFiltered;

    // Tab filter
    if (tab !== "all") {
      items = items.filter(b => betCategory(b) === tab);
    }

    // Model filter
    if (modelFilter !== "all") {
      items = items.filter(b => b.modelType === modelFilter);
    }

    // Star filter
    if (minStars > 0) {
      items = items.filter(b => b.lab.stars >= minStars);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(b =>
        (b.player || "").toLowerCase().includes(q) ||
        b.selection.toLowerCase().includes(q) ||
        b.home.toLowerCase().includes(q) ||
        b.away.toLowerCase().includes(q) ||
        b.marketType.toLowerCase().includes(q) ||
        (b.sport || "").toLowerCase().includes(q) ||
        (b.sport === "MLB" && (q === "baseball" || q === "mlb")) ||
        (b.sport === "NFL" && (q === "football" || q === "nfl")) ||
        (b.sport === "NCAAF" && (q === "college" || q === "cfb" || q === "ncaaf" || q === "college football")) ||
        (b.sport === "NBA" && (q === "basketball" || q === "nba")) ||
        (b.sport === "NHL" && (q === "hockey" || q === "nhl"))
      );
    }

    // Sort
    const sorted = [...items].sort((a, b) => {
      switch (sortMode) {
        case "ev": return b.lab.ev - a.lab.ev || b.lab.hitPct - a.lab.hitPct;
        case "edge": return parseFloat(b.lab.edgePct) - parseFloat(a.lab.edgePct) || b.lab.ev - a.lab.ev;
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
  }, [sportFiltered, tab, modelFilter, minStars, searchQuery, sortMode]);

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
    <div className="flex-1 w-full max-w-full overflow-x-hidden animate-in fade-in duration-500 pt-4 sm:pt-0">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-ink flex flex-wrap items-center gap-2 sm:gap-3">
            The Lab <span className="text-[10px] sm:text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 tracking-normal uppercase">Multi-Model Parlay Builder</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAnalystOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-display font-bold text-xs uppercase tracking-wider transition-all shadow-sm shadow-primary/20 group cursor-pointer"
            >
              <Bot className="size-4 text-primary group-hover:scale-110 transition-transform" />
              <span>Chat Quant AI</span>
              <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
            {allBets.length > 0 && (
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {allBets.length} Plays Analyzed
              </span>
            )}
          </div>
        </div>
        <p className="text-xs sm:text-sm text-muted">
          Every pregame bet ranked by Expected Value and Edge %. Filter by AI Model: 10k Monte Carlo Simulation, Player Prop Labs, Sharp Steam, or Periods.
        </p>
      </div>

      {/* Sport Filter */}
      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      {/* ── BUILD WITH AI CUSTOM PARLAY ARCHITECT ── */}
      <div className="mb-6">
        <AiCustomArchitect rows={scan?.rows || []} cachedProps={cachedProps} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center p-10 text-muted">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          Analyzing all bets across models...
        </div>
      )}

      {!loading && allBets.length > 0 && (
        <div className="flex flex-col gap-3 pb-24">
          {/* Filter bar */}
          <div className="flex flex-col gap-2 sticky top-[calc(5.25rem+env(safe-area-inset-top,0px))] md:top-7 z-20 bg-background/95 backdrop-blur py-2 -mx-1 px-1">
            {/* Row 0: Sport Selection in sticky bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 border-b border-line/40 pb-1.5">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider mr-1 shrink-0">Sport:</span>
              <button
                type="button"
                onClick={() => setSportFilter("ALL")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border shrink-0 flex items-center gap-1.5",
                  !sportFilter || sportFilter === "ALL"
                    ? "bg-neon text-obsidian border-neon font-black shadow-sm"
                    : "bg-panel border-line text-muted hover:text-ink hover:border-primary/40"
                )}
              >
                <span>🌐 All Sports</span>
                <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                  !sportFilter || sportFilter === "ALL" ? "bg-obsidian/20 text-obsidian" : "bg-line text-muted"
                )}>
                  {allBets.length}
                </span>
              </button>
              {liveSports.map((s) => {
                const count = sportCounts[s] || 0;
                const active = sportFilter === s;
                const icon = s === "MLB" ? "⚾" : s === "NFL" ? "🏈" : s === "NCAAF" ? "🏈" : s === "NBA" ? "🏀" : s === "NHL" ? "🏒" : "🎯";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSportFilter(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border shrink-0 flex items-center gap-1.5",
                      active
                        ? "bg-neon text-obsidian border-neon font-black shadow-sm"
                        : "bg-panel border-line text-muted hover:text-ink hover:border-primary/40"
                    )}
                  >
                    <span>{icon} {s}</span>
                    <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                      active ? "bg-obsidian/20 text-obsidian" : "bg-line text-muted"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {sportFilter && sportFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSportFilter("ALL")}
                  className="px-2 py-0.5 text-[9px] text-primary hover:underline font-mono shrink-0 ml-auto flex items-center gap-1"
                >
                  <span>Reset to All Sports ×</span>
                </button>
              )}
            </div>

            {/* Row 1: Bet type tabs + Today Only toggle */}
            <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
              <div className="flex gap-1.5 shrink-0">
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
              <button
                type="button"
                onClick={() => setTodayOnly(!todayOnly)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5 shadow-sm ml-auto",
                  todayOnly
                    ? "bg-amber-400 text-obsidian border-amber-400 font-extrabold shadow-amber-400/20"
                    : "bg-panel border-line text-muted hover:text-ink hover:border-amber-400/50"
                )}
                title="Filter to games scheduled for today's calendar date in Eastern Time"
              >
                <Calendar className="size-3" />
                <span>Today Only</span>
                {todayOnly && <span className="size-1.5 rounded-full bg-obsidian animate-pulse" />}
              </button>
            </div>

            {/* Row 2: AI Model Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider mr-1">Engine:</span>
              {MODEL_FILTERS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setModelFilter(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors border shrink-0 flex items-center gap-1",
                    modelFilter === key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-panel border-line text-muted hover:border-primary/40 hover:text-ink"
                  )}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>

            {/* Row 3: Star filter + Sort + Search */}
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
            <span className="flex items-center gap-2">
              <span>{displayBets.length} bet{displayBets.length !== 1 ? "s" : ""}</span>
              {sportFilter && sportFilter !== "ALL" && (
                <span className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono font-bold lowercase">
                  filtered to {sportFilter}
                </span>
              )}
              <span>· Sorted by {SORT_OPTIONS.find(s => s.key === sortMode)?.label}</span>
            </span>
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
              const startTime = b.start ? formatEasternShort(b.start) : "";
              const sportLabel = (b.sport || "").replace("americanfootball_", "").replace("icehockey_", "").replace("baseball_", "").replace("basketball_", "").toUpperCase();

              // Resolve team logo accurately using resolveLegTeam
              const legTeam = resolveLegTeam({
                sport: b.sport,
                home: b.home,
                away: b.away,
                homeAbbr: b.homeAbbr,
                awayAbbr: b.awayAbbr,
                homeLogo: b.homeLogo,
                awayLogo: b.awayLogo,
                selection: b.selection,
                side: b.side,
              });

              const isHome = b.side === "home";
              const isAway = b.side === "away";
              const teamName = isHome
                ? (legTeam.homeName || b.home || "Home Team")
                : isAway
                  ? (legTeam.awayName || b.away || "Away Team")
                  : (!/^(home|away|over|under)/i.test(b.selection) ? b.selection : (legTeam.homeName || b.home || "Team"));

              let displayName = "";
              let subtitle = "";

              if (playerName) {
                displayName = playerName;
                subtitle = formatPropLabel(b);
              } else {
                if (b.marketType === "spread") {
                  const pt = b.point != null ? (b.point > 0 ? `+${b.point}` : `${b.point}`) : "";
                  displayName = `${teamName} ${pt}`.trim();
                  subtitle = b.sport === "MLB" ? "Run Line" : b.sport === "NHL" ? "Puck Line" : "Spread";
                } else if (b.marketType === "ml") {
                  displayName = teamName;
                  subtitle = "Moneyline";
                } else if (b.marketType === "total") {
                  const isUnder = b.side === "under" || /\bunder\b/i.test(b.selection);
                  displayName = `${isUnder ? "Under" : "Over"} ${b.point ?? ""}`.trim();
                  subtitle = b.sport === "MLB" ? "Game Total Runs" : b.sport === "NHL" ? "Game Total Goals" : "Game Total";
                } else {
                  displayName = teamName;
                  subtitle = marketLabel(b.marketType);
                }
              }

              const initials = playerName ? playerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";
              const logoUrl = isHome
                ? (legTeam.homeLogo || b.homeLogo)
                : isAway
                  ? (legTeam.awayLogo || b.awayLogo)
                  : (legTeam.selectionLogo || legTeam.homeLogo || legTeam.awayLogo);

              const dyn = calculateDynamicWager({
                totalBankroll,
                baseUnitSize,
                riskMode: riskProfileMode,
                fairProb: b.fairProb,
                bookOdds: b.price,
              });

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
                      <BetAvatar
                        headshot={b.headshot}
                        logoUrl={!playerName ? logoUrl : undefined}
                        initials={initials}
                        playerName={playerName}
                      />
                      <div className="flex gap-px">{renderStars(stars)}</div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-ink truncate">{displayName}</span>

                        {/* Sport Badge */}
                        <span className={cn(
                          "text-[8px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 border",
                          b.sport === "MLB" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" :
                          b.sport === "NFL" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                          b.sport === "NCAAF" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                          "bg-primary/10 text-primary border-primary/20"
                        )}>
                          {b.sport === "MLB" ? "⚾ MLB" : b.sport === "NFL" ? "🏈 NFL" : b.sport === "NCAAF" ? "🏈 NCAAF" : b.sport}
                        </span>

                        {/* Model Badge */}
                        {b.modelType === "prop" && (
                          <span className="text-[8px] font-mono bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">
                            👤 PROP LAB
                          </span>
                        )}
                        {b.modelType === "sharp" && (
                          <span className="text-[8px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">
                            📈 SHARP STEAM
                          </span>
                        )}
                        {b.modelType === "period" && (
                          <span className="text-[8px] font-mono bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">
                            ⏱️ PERIOD
                          </span>
                        )}
                        {b.modelType === "sim" && (
                          <span className="text-[8px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">
                            ⚡ 10K SIM
                          </span>
                        )}

                        {isGameLine && (
                          <span className="text-[8px] bg-line text-muted rounded px-1 font-bold shrink-0">
                            {marketLabel(b.marketType).toUpperCase()}
                          </span>
                        )}
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

                  {/* Hit bar + EV + Edge */}
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
                        <span className={cn("text-[9px] font-mono px-1 rounded font-bold", parseFloat(b.lab.edgePct) > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                          {b.lab.edgePct} edge
                        </span>
                      )}
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20"
                        title={`Recommended Kelly Stake (${riskProfileMode}): $${dyn.wagerDollars} (${dyn.unitCount}u)`}
                      >
                        Rec: ${dyn.wagerDollars}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedBetId(expandedBetId === b.id ? null : b.id);
                        }}
                        className="ml-auto text-[9px] font-mono font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 hover:bg-primary/15 px-2 py-0.5 rounded border border-primary/25 transition-colors shrink-0"
                      >
                        <Activity className="size-2.5" />
                        <span>{expandedBetId === b.id ? "Hide Sim" : "Sim & Form"}</span>
                        {expandedBetId === b.id ? <ChevronUp className="size-2.5" /> : <ChevronDown className="size-2.5" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-muted italic ml-0.5">
                      {b.lab.label} — {b.lab.hitPct >= 70 ? "wins most of the time" : b.lab.hitPct >= 55 ? "better than a coin flip" : b.lab.hitPct >= 45 ? "could go either way" : b.lab.hitPct >= 30 ? "lower chance, bigger payout" : "risky but high reward"}
                    </p>
                    <AnimatePresence>
                      {expandedBetId === b.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-2 border-t border-line/60 overflow-hidden"
                        >
                          <DistributionChart
                            title={`${displayName} — Quant Distribution & Form`}
                            subtitle="10,000 Monte Carlo Simulation Trials vs Market Line & Historical Performance"
                            line={b.point != null && Number.isFinite(Number(b.point)) ? Number(b.point) : 21.5}
                            fairProb={b.fairProb}
                            marketProb={b.chance}
                            isOver={/over/i.test(b.selection) || !/under/i.test(b.selection)}
                            unit={b.marketType === "total" ? "pts" : ""}
                            marketType={b.isProp ? "prop" : b.marketType}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {displayBets.length === 0 && (
            <div className="text-center p-8 text-muted text-sm border border-dashed border-line rounded-xl">
              No bets match your filters. Try adjusting tabs, models, stars, or search.
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

      {/* ── Conversational Quant Intelligence Drawer ── */}
      <AiAnalystDrawer
        isOpen={isAnalystOpen}
        onClose={() => setIsAnalystOpen(false)}
        scanRows={scan?.rows || []}
      />
    </div>
  );
}