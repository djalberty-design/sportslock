import React from "react";
import type { ScanRow } from "@/lib/market/types";
import { useParlaySlip, isLegSelected, type ParlayLeg } from "@/lib/parlay-slip";
import { formatAmerican } from "@/lib/market/hit-pct";
import { cn } from "@/lib/utils";
import { resolveLegTeam, resolvePlayerHeadshotSync, fetchPlayerHeadshot } from "@/lib/market/logos";
import { QuantFactorWaterfall } from "./quant-factor-waterfall";
import { computeQuantFactorWaterfall } from "@/lib/market/waterfall";
import {
  TrendingUp,
  Target,
  Zap,
  Plus,
  Check,
  Sparkles,
  User,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Clock,
} from "lucide-react";

interface AiTopSinglesProps {
  rows: ScanRow[];
  cachedProps?: any[];
}

interface SingleCategoryBet {
  category: "ML" | "SPREAD" | "TOTAL" | "PROP";
  categoryLabel: string;
  badgeColor: string;
  badgeBg: string;
  row: ScanRow | null;
  playerData?: any;
}

function TopSingleAvatar({ row }: { row: ScanRow }) {
  const [headshot, setHeadshot] = React.useState<string | undefined>(
    row.headshot || (row.player ? resolvePlayerHeadshotSync(row.player) || undefined : undefined)
  );
  const [imgErr, setImgErr] = React.useState(false);

  React.useEffect(() => {
    if (row.headshot) {
      setHeadshot(row.headshot);
      setImgErr(false);
      return;
    }
    if (row.isProp && row.player) {
      const sync = resolvePlayerHeadshotSync(row.player);
      if (sync) {
        setHeadshot(sync);
        setImgErr(false);
      } else {
        fetchPlayerHeadshot(row.player, row.sport).then((url) => {
          if (url) {
            setHeadshot(url);
            setImgErr(false);
          }
        }).catch(() => {});
      }
    }
  }, [row.headshot, row.player, row.isProp, row.sport]);

  if (row.isProp && row.player) {
    if (headshot && !imgErr) {
      return (
        <img
          src={headshot}
          alt={row.player}
          onError={() => setImgErr(true)}
          className="size-9 rounded-full ring-2 ring-line bg-obsidian object-cover shrink-0"
        />
      );
    }
    const initials = row.player
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      <div className="size-9 rounded-full bg-purple-500/10 border border-purple-500/30 ring-2 ring-line flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-purple-300 font-mono">{initials || "P"}</span>
      </div>
    );
  }

  // Game line (ML, Spread, Total)
  const teams = resolveLegTeam(row);
  if (row.marketType === "total") {
    return (
      <div className="flex items-center -space-x-2 shrink-0">
        <span className="relative size-7 shrink-0">
          <span className="absolute inset-0 rounded-full bg-line ring-2 ring-panel flex items-center justify-center text-[9px] font-bold text-muted">
            {teams.awayName?.charAt(0) || "A"}
          </span>
          {teams.awayLogo && (
            <img
              src={teams.awayLogo}
              alt={teams.awayName || "Away"}
              className="relative size-7 rounded-full ring-2 ring-panel bg-white object-contain"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
            />
          )}
        </span>
        <span className="relative size-7 shrink-0">
          <span className="absolute inset-0 rounded-full bg-line ring-2 ring-panel flex items-center justify-center text-[9px] font-bold text-muted">
            {teams.homeName?.charAt(0) || "H"}
          </span>
          {teams.homeLogo && (
            <img
              src={teams.homeLogo}
              alt={teams.homeName || "Home"}
              className="relative size-7 rounded-full ring-2 ring-panel bg-white object-contain"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
            />
          )}
        </span>
      </div>
    );
  }

  // ML / Spread - show picked team logo or both
  const logo = teams.selectionLogo || teams.homeLogo || teams.awayLogo;
  const name = teams.side === "away" ? teams.awayName : teams.homeName;
  const letter = (name || "?").charAt(0).toUpperCase();

  return (
    <span className="relative size-9 shrink-0">
      <span className="absolute inset-0 rounded-full bg-line ring-2 ring-panel flex items-center justify-center text-xs font-bold text-muted">
        {letter}
      </span>
      {logo && (
        <img
          src={logo}
          alt={name || ""}
          className="relative size-9 rounded-full ring-2 ring-panel bg-white object-contain p-0.5"
          onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
        />
      )}
    </span>
  );
}

export function AiTopSingles({ rows, cachedProps = [] }: AiTopSinglesProps) {
  const { legs: slipLegs, addLeg, removeLeg } = useParlaySlip();

  // 1. Best Moneyline (highest EV, fallback to highest win prob)
  const bestMl = React.useMemo(() => {
    const mls = rows.filter(
      (r) =>
        r.marketType === "ml" &&
        !r.isProp &&
        !r.inPlay &&
        r.tag !== "illegal_fl" &&
        Number.isFinite(r.fairProb) &&
        r.fairProb >= 0.40,
    );
    if (mls.length > 0) {
      return mls.sort((a, b) => (b.evPct ?? -99) - (a.evPct ?? -99))[0];
    }
    const anyMl = rows.filter(
      (r) => r.marketType === "ml" && !r.isProp && !r.inPlay && r.tag !== "illegal_fl" && Number.isFinite(r.fairProb)
    );
    return anyMl.sort((a, b) => (b.fairProb ?? 0) - (a.fairProb ?? 0))[0] ?? null;
  }, [rows]);

  // 2. Best Spread (highest EV, fallback to highest win prob)
  const bestSpread = React.useMemo(() => {
    const spreads = rows.filter(
      (r) =>
        r.marketType === "spread" &&
        !r.isProp &&
        !r.inPlay &&
        r.tag !== "illegal_fl" &&
        Number.isFinite(r.fairProb) &&
        r.fairProb >= 0.45,
    );
    if (spreads.length > 0) {
      return spreads.sort((a, b) => (b.evPct ?? -99) - (a.evPct ?? -99))[0];
    }
    const anySpread = rows.filter(
      (r) => r.marketType === "spread" && !r.isProp && !r.inPlay && r.tag !== "illegal_fl" && Number.isFinite(r.fairProb)
    );
    return anySpread.sort((a, b) => (b.fairProb ?? 0) - (a.fairProb ?? 0))[0] ?? null;
  }, [rows]);

  // 3. Best Total (Over/Under)
  const bestTotal = React.useMemo(() => {
    const totals = rows.filter(
      (r) =>
        r.marketType === "total" &&
        !r.isProp &&
        !r.inPlay &&
        r.tag !== "illegal_fl" &&
        Number.isFinite(r.fairProb) &&
        r.fairProb >= 0.45,
    );
    if (totals.length > 0) {
      return totals.sort((a, b) => (b.evPct ?? -99) - (a.evPct ?? -99))[0];
    }
    const anyTotal = rows.filter(
      (r) => r.marketType === "total" && !r.isProp && !r.inPlay && r.tag !== "illegal_fl" && Number.isFinite(r.fairProb)
    );
    return anyTotal.sort((a, b) => (b.fairProb ?? 0) - (a.fairProb ?? 0))[0] ?? null;
  }, [rows]);

  // 4. Best Player Prop
  const bestProp = React.useMemo(() => {
    // Check rows first
    const propRows = rows.filter(
      (r) =>
        r.isProp &&
        !r.inPlay &&
        r.tag !== "illegal_fl" &&
        Number.isFinite(r.fairProb) &&
        r.fairProb >= 0.45,
    );
    if (propRows.length > 0) {
      return propRows.sort((a, b) => (b.evPct ?? -99) - (a.evPct ?? -99))[0];
    }
    // Fallback to active cached props
    if (cachedProps && cachedProps.length > 0) {
      const sorted = [...cachedProps].sort((a, b) => {
        const ea = Number(a.aiEdge ?? a.edge ?? 0);
        const eb = Number(b.aiEdge ?? b.edge ?? 0);
        return eb - ea || Number(b.aiProb ?? b.fairProb ?? 0) - Number(a.aiProb ?? a.fairProb ?? 0);
      });
      const top = sorted[0];
      if (top) {
        return {
          eventId: top.eventId || "prop-top",
          sport: top.sport || "MLB",
          start: top.start || new Date().toISOString(),
          home: top.home || "",
          away: top.away || "",
          marketType: top.marketType || "prop",
          side: top.side || "",
          selection: top.selection || `${top.player} Prop`,
          price: top.price || -110,
          fairProb: Number(top.aiProb ?? top.fairProb ?? 0.55),
          evPct: Number(top.aiEdge ?? top.edge ?? 0.05),
          isProp: true,
          player: top.player,
          headshot: top.headshot || (top.row as any)?.headshot,
          homeLogo: top.homeLogo || (top.row as any)?.homeLogo,
          awayLogo: top.awayLogo || (top.row as any)?.awayLogo,
          homeAbbr: top.homeAbbr || (top.row as any)?.homeAbbr,
          awayAbbr: top.awayAbbr || (top.row as any)?.awayAbbr,
          tag: "fair_or_better",
          action: "enter_ticket",
          conviction: "high",
        } as ScanRow;
      }
    }
    return null;
  }, [rows, cachedProps]);

  const categories: SingleCategoryBet[] = [
    {
      category: "ML",
      categoryLabel: "Best Moneyline",
      badgeColor: "text-emerald-400",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30",
      row: bestMl,
    },
    {
      category: "SPREAD",
      categoryLabel: "Best Spread",
      badgeColor: "text-blue-400",
      badgeBg: "bg-blue-500/10 border-blue-500/30",
      row: bestSpread,
    },
    {
      category: "TOTAL",
      categoryLabel: "Best Over/Under",
      badgeColor: "text-amber-400 dark:text-amber-300 font-bold",
      badgeBg: "bg-amber-400/15 border-amber-400/30",
      row: bestTotal,
    },
    {
      category: "PROP",
      categoryLabel: "Best Player Prop",
      badgeColor: "text-purple-400",
      badgeBg: "bg-purple-500/10 border-purple-500/30",
      row: bestProp,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-primary uppercase tracking-wider">
              <Sparkles className="size-3.5" /> High-Conviction Single Plays
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-ink tracking-tight mt-0.5">
            Top AI Single Bets by Market
          </h2>
          <p className="text-[11px] text-muted">
            The mathematical #1 play across each core market category, selected by 10k simulations, Bayesian line consensus, and expected value.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const r = cat.row;
          if (!r) {
            return (
              <div
                key={cat.category}
                className="bg-panel border border-line/60 rounded-xl p-4 flex flex-col justify-between min-h-[160px] opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded border", cat.badgeBg, cat.badgeColor)}>
                    {cat.categoryLabel}
                  </span>
                </div>
                <div className="text-center py-4">
                  <p className="text-xs text-muted">No qualified play meets the edge floor right now.</p>
                </div>
              </div>
            );
          }

          const inSlip = isLegSelected(slipLegs, r.selection, r.marketType, r.eventId, r.player);
          const ev = r.evPct ?? 0;
          const evText = ev > 0 ? `+${(ev * 100).toFixed(1)}%` : `${(ev * 100).toFixed(1)}%`;
          const vegasImplied = r.price < 0 ? Math.round((-r.price / (-r.price + 100)) * 100) : Math.round((100 / (r.price + 100)) * 100);
          const aiHit = Math.round(r.fairProb * 100);

          const matchupText = r.isProp && r.player
            ? `${r.player} · ${r.sport}`
            : r.home && r.away
              ? `${r.away} @ ${r.home}`
              : r.sport;

          const dateObj = r.start ? new Date(r.start) : null;
          const isValidDate = Boolean(dateObj && !isNaN(dateObj.getTime()));
          const dateFormatted = isValidDate
            ? dateObj!.toLocaleDateString([], { month: "short", day: "numeric" })
            : null;
          const timeFormatted = isValidDate
            ? dateObj!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : null;
          const startFormatted = isValidDate ? `${dateFormatted} · ${timeFormatted}` : null;

          const handleToggleSlip = () => {
            if (inSlip) {
              removeLeg(r.selection, r.marketType, r.eventId, r.player);
            } else {
              const leg: ParlayLeg = {
                eventId: r.eventId,
                selection: r.selection,
                marketType: r.marketType,
                side: r.side,
                point: r.point,
                price: r.price,
                fairProb: r.fairProb,
                sport: r.sport,
                home: r.home,
                away: r.away,
                player: r.player,
              };
              addLeg(leg);
            }
          };

          return (
            <div
              key={cat.category}
              className="bg-panel border border-line hover:border-line/90 rounded-xl p-4 flex flex-col justify-between relative group transition-all shadow-sm"
            >
              <div>
                {/* Header Badge & Sport */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider", cat.badgeBg, cat.badgeColor)}>
                    {cat.categoryLabel}
                  </span>
                  <span className="text-[10px] font-mono text-muted uppercase font-bold">
                    {r.sport}
                  </span>
                </div>

                {/* Matchup & Selection with Avatar */}
                <div className="flex items-center gap-3 mb-2">
                  <TopSingleAvatar row={r} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted truncate">
                      {matchupText}
                    </div>
                    <div className="text-sm font-bold text-ink leading-snug line-clamp-2 min-h-[38px] flex items-center">
                      {r.selection}
                    </div>
                    {startFormatted ? (
                      <div className="text-[10px] text-muted font-mono flex items-center gap-1 mt-1">
                        <Clock className="size-3 text-muted/70 shrink-0" />
                        <span>{startFormatted}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Metrics Box */}
                <div className="grid grid-cols-3 gap-1.5 bg-obsidian border border-line/60 rounded-lg p-2.5 my-3 text-center">
                  <div>
                    <div className="text-[9px] text-muted font-mono uppercase">Our AI</div>
                    <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                      {aiHit}%
                    </div>
                  </div>
                  <div className="border-x border-line/50">
                    <div className="text-[9px] text-muted font-mono uppercase">Vegas</div>
                    <div className="text-xs font-bold text-ink font-mono mt-0.5">
                      {formatAmerican(r.price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted font-mono uppercase">Edge</div>
                    <div className="text-xs font-bold text-primary font-mono mt-0.5">
                      {evText}
                    </div>
                  </div>
                </div>

                {/* Quant Factor Attribution Waterfall */}
                <div className="mb-3 space-y-1 w-full max-w-full overflow-hidden">
                  <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-wider text-muted px-0.5">
                    <span>Quant Factor Decomposition</span>
                    <span className="text-[8px] font-mono text-primary font-normal">Base &rarr; Sim &rarr; Edges</span>
                  </div>
                  <QuantFactorWaterfall
                    waterfall={r.waterfall || computeQuantFactorWaterfall(r)}
                    compact={true}
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleToggleSlip}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                  inSlip
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-panel border border-line text-ink hover:border-primary/50 hover:text-primary",
                )}
              >
                {inSlip ? (
                  <>
                    <Check className="size-3.5 text-emerald-400" />
                    <span>In Parlay Slip</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Add to Slip</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
