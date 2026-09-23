import React, { useState, useMemo } from "react";
import type { ScanRow, ParlayCandidate } from "@/lib/market/types";
import { useParlaySlip, type ParlayLeg } from "@/lib/parlay-slip";
import { formatAmerican } from "@/lib/market/hit-pct";
import { evaluateParlay, americanToDecimal, decimalToAmerican, evPct } from "@/lib/market/engine";
import { cn } from "@/lib/utils";
import { TicketLegAvatar } from "./ticket-leg-avatar";
import {
  Sparkles,
  Layers,
  Zap,
  TrendingUp,
  Target,
  Plus,
  Check,
  CheckCircle2,
  Sliders,
  Flame,
  ArrowRight,
} from "lucide-react";

interface AiCustomArchitectProps {
  rows: ScanRow[];
  cachedProps?: any[];
}

type Recipe = "all_market" | "game_lines" | "props_hybrid" | "spreads_only" | "underdog_plus";

const RECIPES: { id: Recipe; label: string; desc: string }[] = [
  { id: "all_market", label: "Optimal AI Blend", desc: "Highest joint EV across games & props" },
  { id: "game_lines", label: "Game Lines Only", desc: "Moneylines, Spreads, & Totals" },
  { id: "props_hybrid", label: "Props & Games Hybrid", desc: "Player props mixed with game lines" },
  { id: "spreads_only", label: "Spread Specialists", desc: "Against-the-spread value covers" },
  { id: "underdog_plus", label: "Plus-Money Hunters", desc: "Underdogs & high-multiplier payouts" },
];

export function AiCustomArchitect({ rows, cachedProps = [] }: AiCustomArchitectProps) {
  const [legCount, setLegCount] = useState<2 | 3 | 4>(2);
  const [recipe, setRecipe] = useState<Recipe>("all_market");
  const [addedSuccess, setAddedSuccess] = useState(false);

  const { addLeg } = useParlaySlip();

  // Combine rows and cached props into candidate pool
  const candidatePool = useMemo(() => {
    const list: ScanRow[] = [...rows];

    // Append cached props if not already in rows
    if (cachedProps && cachedProps.length > 0) {
      const existingIds = new Set(list.map((r) => `${r.eventId}|${r.selection}`));
      for (const p of cachedProps) {
        const key = `${p.eventId || ""}|${p.selection || ""}`;
        if (existingIds.has(key)) continue;
        existingIds.add(key);

        const edge = Number(p.aiEdge ?? p.edge ?? 0);
        const fairProb = Number(p.aiProb ?? p.fairProb ?? 0.55);
        if (edge >= 0.015 && fairProb >= 0.45) {
          list.push({
            eventId: p.eventId || "prop-cand",
            sport: p.sport || "MLB",
            start: p.start || new Date().toISOString(),
            home: p.home || "",
            away: p.away || "",
            marketType: p.marketType || "prop",
            side: p.side || "",
            selection: p.selection || `${p.player} Prop`,
            price: p.price || -110,
            fairProb,
            evPct: edge,
            isProp: true,
            player: p.player,
            headshot: p.headshot || (p.row as any)?.headshot,
            homeLogo: p.homeLogo || (p.row as any)?.homeLogo,
            awayLogo: p.awayLogo || (p.row as any)?.awayLogo,
            homeAbbr: p.homeAbbr || (p.row as any)?.homeAbbr,
            awayAbbr: p.awayAbbr || (p.row as any)?.awayAbbr,
            tag: "fair_or_better",
            action: "enter_ticket",
            conviction: "high",
          } as ScanRow);
        }
      }
    }

    return list.filter(
      (r) =>
        !r.inPlay &&
        r.tag !== "illegal_fl" &&
        r.tag !== "unknown_market" &&
        Number.isFinite(r.fairProb) &&
        r.fairProb >= 0.40,
    );
  }, [rows, cachedProps]);

  // Build the optimal combination for the selected recipe and leg count
  const architectResult = useMemo(() => {
    // 1. Filter by recipe
    let eligible = candidatePool.filter((r) => {
      if (recipe === "game_lines") return !r.isProp && ["ml", "spread", "total"].includes(r.marketType);
      if (recipe === "spreads_only") return r.marketType === "spread";
      if (recipe === "underdog_plus") return r.price >= 100;
      return true;
    });

    if (recipe === "props_hybrid") {
      const propLegs = candidatePool.filter((r) => r.isProp);
      const gameLegs = candidatePool.filter((r) => !r.isProp && ["ml", "spread", "total"].includes(r.marketType));
      if (propLegs.length > 0 && gameLegs.length > 0) {
        eligible = [...propLegs.slice(0, 10), ...gameLegs.slice(0, 10)];
      } else {
        eligible = candidatePool;
      }
    }

    // Fallback if specific recipe pool is smaller than required legs
    if (eligible.length < legCount) {
      eligible = candidatePool;
    }

    // Sort by individual EV & value
    eligible.sort((a, b) => (b.evPct ?? 0) - (a.evPct ?? 0));
    const seeds = eligible.slice(0, 14);

    if (seeds.length < legCount) return null;

    // Helper for combinations
    function getCombos<T>(arr: T[], k: number): T[][] {
      const out: T[][] = [];
      const acc: T[] = [];
      function recurse(start: number, depth: number) {
        if (depth === k) {
          out.push([...acc]);
          return;
        }
        for (let i = start; i <= arr.length - (k - depth); i++) {
          acc[depth] = arr[i];
          recurse(i + 1, depth + 1);
        }
      }
      recurse(0, 0);
      return out;
    }

    const allCombos = getCombos(seeds, legCount);
    let bestCand: ParlayCandidate | null = null;
    let bestScore = -999;

    for (const combo of allCombos) {
      // Must have unique events
      if (new Set(combo.map((l) => l.eventId)).size !== legCount) continue;

      // For props_hybrid: require at least 1 prop and 1 game line when both exist in seeds
      if (recipe === "props_hybrid" && seeds.some(l => l.isProp) && seeds.some(l => !l.isProp)) {
        const hasProp = combo.some((l) => l.isProp);
        const hasGame = combo.some((l) => !l.isProp);
        if (!hasProp || !hasGame) continue;
      }

      // Anti-hedge: Don't pick opposing sides from same matchup
      const matchups = combo.map((l) => [l.home || "", l.away || ""].sort().join(" vs "));
      if (new Set(matchups).size < legCount) {
        let hasConflict = false;
        const byMatchup = new Map<string, string[]>();
        for (const l of combo) {
          const mKey = [l.home || "", l.away || ""].sort().join(" vs ");
          const existing = byMatchup.get(mKey) || [];
          const opposite = l.side === "home" ? "away" : l.side === "away" ? "home" : null;
          if (opposite && existing.includes(opposite)) {
            hasConflict = true;
            break;
          }
          if (l.side) existing.push(l.side);
          byMatchup.set(mKey, existing);
        }
        if (hasConflict) continue;
      }

      const evaluated = evaluateParlay(combo, undefined, "catalog");
      if ("ok" in evaluated && evaluated.ok === false) continue;

      const cand = evaluated as ParlayCandidate;
      const score = (cand.score ?? 0) + (cand.combinedEv ?? 0) * 10;
      if (score > bestScore) {
        bestScore = score;
        bestCand = cand;
      }
    }

    // Direct fallback with top unique-event seeds if all combos were strictly pruned
    if (!bestCand && seeds.length >= legCount) {
      const uniqueSeeds: ScanRow[] = [];
      const seenEvents = new Set<string>();
      for (const s of seeds) {
        if (!seenEvents.has(s.eventId)) {
          seenEvents.add(s.eventId);
          uniqueSeeds.push(s);
          if (uniqueSeeds.length === legCount) break;
        }
      }
      if (uniqueSeeds.length === legCount) {
        const evaluated = evaluateParlay(uniqueSeeds, undefined, "catalog");
        if (!("ok" in evaluated && evaluated.ok === false)) {
          bestCand = evaluated as ParlayCandidate;
        }
      }
    }

    return bestCand;
  }, [candidatePool, legCount, recipe]);

  const handleAddAllToSlip = () => {
    if (!architectResult?.legs) return;
    for (const l of architectResult.legs) {
      const leg: ParlayLeg = {
        eventId: l.eventId,
        selection: l.selection,
        marketType: l.marketType,
        side: l.side,
        price: l.price,
        fairProb: l.fairProb,
        sport: l.sport,
        home: l.home,
        away: l.away,
      };
      addLeg(leg);
    }
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  return (
    <section className="bg-panel border border-line rounded-xl p-4 sm:p-6 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-3.5" /> AI PARLAY ARCHITECT
            </span>
            <span className="text-xs text-muted font-mono">Bespoke Combinations</span>
          </div>
          <h2 className="text-xl font-display font-bold text-ink mt-1">
            Build With AI Custom Parlay Engine
          </h2>
          <p className="text-xs text-muted mt-0.5 max-w-2xl">
            Choose your desired number of legs and target betting style. The AI quant engine tests all multi-leg correlation structures and solves for the optimal combination.
          </p>
        </div>
      </div>

      {/* Controls: Leg Count & Recipe Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leg Count Selector */}
        <div>
          <label className="text-xs font-mono font-bold text-muted uppercase tracking-wider block mb-2">
            1. Select Number of Legs:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                onClick={() => setLegCount(count as 2 | 3 | 4)}
                className={cn(
                  "py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5",
                  legCount === count
                    ? "bg-primary text-black border-primary shadow-sm"
                    : "bg-obsidian border-line text-muted hover:text-ink hover:border-line/90",
                )}
              >
                <Layers className="size-3.5" />
                <span>{count} Legs</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Selector */}
        <div>
          <label className="text-xs font-mono font-bold text-muted uppercase tracking-wider block mb-2">
            2. Select Strategy Recipe:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {RECIPES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRecipe(r.id)}
                className={cn(
                  "p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between min-h-[64px]",
                  recipe === r.id
                    ? "bg-primary/10 border-primary ring-1 ring-primary/40 text-ink"
                    : "bg-obsidian border-line text-muted hover:text-ink hover:border-line/90",
                )}
              >
                <div className="text-[11px] font-bold leading-tight mb-1">{r.label}</div>
                <div className="text-[9.5px] text-muted leading-snug break-words">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Synthesis Display Box */}
      {architectResult ? (
        <div className="bg-obsidian border border-line rounded-xl p-4 sm:p-5 space-y-4">
          {/* Output Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                AI Architect Solved · {legCount} Legs
              </span>
              <h3 className="text-lg font-bold text-ink mt-1">
                {architectResult.title}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {architectResult.reason}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 bg-panel border border-line p-3 rounded-xl shrink-0">
              <div className="text-center">
                <div className="text-[9px] text-muted font-mono uppercase">Payout</div>
                <div className="text-sm font-bold font-mono text-ink mt-0.5">
                  {formatAmerican(decimalToAmerican(architectResult.decimalPayout ?? 2))}
                </div>
                <div className="text-[10px] text-muted font-mono">
                  {(architectResult.decimalPayout ?? 2).toFixed(2)}x
                </div>
              </div>
              <div className="w-px h-8 bg-line" />
              <div className="text-center">
                <div className="text-[9px] text-muted font-mono uppercase">AI Chance</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {(architectResult.combinedFair * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted font-mono">True Hit</div>
              </div>
              <div className="w-px h-8 bg-line" />
              <div className="text-center">
                <div className="text-[9px] text-muted font-mono uppercase">Net Edge</div>
                <div className="text-sm font-bold font-mono text-primary mt-0.5">
                  +{((architectResult.combinedEv ?? 0.05) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted font-mono">Quant EV</div>
              </div>
            </div>
          </div>

          {/* Leg List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {architectResult.legs.map((leg, idx) => (
              <div
                key={`${leg.eventId}-${idx}`}
                className="bg-panel border border-line/70 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="size-6 rounded-full bg-obsidian border border-line flex items-center justify-center text-[10px] font-mono font-bold text-muted shrink-0">
                    {idx + 1}
                  </span>
                  <TicketLegAvatar leg={leg} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">
                      {leg.selection}
                    </div>
                    <div className="text-[10px] text-muted truncate">
                      {leg.home && leg.away ? `${leg.away} @ ${leg.home}` : leg.sport} · {leg.marketType.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-ink">
                    {formatAmerican(leg.price)}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400">
                    {Math.round(leg.fairProb * 100)}% hit
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add All Button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleAddAllToSlip}
              className={cn(
                "flex items-center gap-2 py-2.5 px-5 rounded-lg text-xs font-bold transition-all shadow-md",
                addedSuccess
                  ? "bg-emerald-500 text-black"
                  : "bg-primary text-black hover:bg-primary/90",
              )}
            >
              {addedSuccess ? (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Added {legCount} Legs to Slip!</span>
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  <span>Add All {legCount} Legs to Parlay Slip</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-line rounded-xl">
          <p className="text-xs text-muted">
            No combination currently satisfies the "{RECIPES.find((r) => r.id === recipe)?.label}" recipe at {legCount} legs with positive expected value. Try another recipe or leg count.
          </p>
        </div>
      )}
    </section>
  );
}
