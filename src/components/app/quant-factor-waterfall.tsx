import React, { useState } from "react";
import type { QuantFactorCategory, QuantFactorItem, QuantWaterfall } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Activity,
  Layers,
  Wind,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Sliders,
  Sparkles,
} from "lucide-react";

interface QuantFactorWaterfallProps {
  waterfall: QuantWaterfall;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<QuantFactorCategory, React.ElementType> = {
  market: ShieldCheck,
  sim: Zap,
  schedule: Activity,
  steam: TrendingUp,
  environment: Wind,
};

const CATEGORY_COLORS: Record<QuantFactorCategory, { text: string; bg: string; border: string }> = {
  market: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  sim: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  schedule: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  steam: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  environment: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
};

export function QuantFactorWaterfall({ waterfall, compact = false }: QuantFactorWaterfallProps) {
  const [expanded, setExpanded] = useState(!compact);

  const edgeBp = waterfall.netEdgeBp;
  const isPositive = edgeBp >= 0;

  return (
    <div className="rounded-xl border border-line/70 bg-panel/70 p-3.5 space-y-3 font-sans transition-all shadow-sm">
      {/* Header Bar */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 select-none",
          compact && "cursor-pointer"
        )}
        onClick={() => compact && setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Layers className="size-3.5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink">Quant Factor Waterfall</span>
              <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20">
                Institutional Alpha
              </span>
            </div>
            <p className="text-[10px] text-muted">Orthogonal decomposition of model edge & win probability</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span
              className={cn(
                "text-xs font-mono font-bold px-2 py-0.5 rounded border",
                isPositive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              )}
            >
              {isPositive ? `+${edgeBp} bp` : `${edgeBp} bp`} ({(edgeBp / 100).toFixed(1)}% EV)
            </span>
          </div>
          {compact && (
            <button
              type="button"
              className="size-6 rounded flex items-center justify-center hover:bg-line text-muted"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Factor List */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-line/40 animate-in fade-in duration-300">
          {/* Baseline summary bar */}
          <div className="flex items-center justify-between text-[11px] bg-wash/60 px-2.5 py-1.5 rounded-lg border border-line/40 font-mono">
            <span className="text-muted">Consensus Implied:</span>
            <span className="text-ink font-bold">{(waterfall.marketAnchorProb * 100).toFixed(1)}%</span>
            <span className="text-muted/40">→</span>
            <span className="text-muted">SportsLock Model:</span>
            <span className="text-primary font-bold">{(waterfall.modelProb * 100).toFixed(1)}%</span>
          </div>

          {/* Factor Rows */}
          <div className="space-y-1.5">
            {waterfall.factors.map((f, i) => {
              const Icon = CATEGORY_ICONS[f.category] || Activity;
              const styling = CATEGORY_COLORS[f.category] || { text: "text-muted", bg: "bg-wash", border: "border-line" };
              const isNonZero = f.impactBp !== 0;

              return (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-surface/50 border border-line/40 text-xs hover:border-line transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-5 rounded flex items-center justify-center shrink-0 border", styling.bg, styling.border, styling.text)}>
                      <Icon className="size-3" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink text-[11px] truncate">{f.name}</span>
                        <span className="text-[9px] font-mono text-muted/80">({f.weightPct}% blend)</span>
                      </div>
                      <p className="text-[10px] text-muted truncate">{f.detail}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center self-end shrink-0 pl-7 sm:pl-0">
                    {isNonZero ? (
                      <span
                        className={cn(
                          "font-mono font-bold text-[10px] px-1.5 py-0.5 rounded",
                          f.impactBp > 0
                            ? "text-emerald-400 bg-emerald-500/10"
                            : "text-rose-400 bg-rose-500/10"
                        )}
                      >
                        {f.impactBp > 0 ? `+${f.impactBp} bp` : `${f.impactBp} bp`}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-muted px-1.5 py-0.5 rounded bg-wash">
                        Anchor Base
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted/70 italic pt-1 leading-relaxed">
            {waterfall.summary}
          </p>
        </div>
      )}
    </div>
  );
}
