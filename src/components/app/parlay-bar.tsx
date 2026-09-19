import { useParlaySlip, combinedOdds } from "@/lib/parlay-slip";
import { cn } from "@/lib/utils";
import { X, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export function ParlayBar() {
  const { legs, removeLeg, clearAll } = useParlaySlip();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (legs.length === 0) return null;

  const { american, decPayout, combinedProb } = combinedOdds(legs);
  const probPct = Math.round(combinedProb * 100);
  const isSingle = legs.length === 1;
  const label = isSingle ? "STRAIGHT BET" : `${legs.length}-LEG PARLAY`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
      {/* Expanded leg list */}
      {expanded && (
        <div className="bg-obsidian/95 backdrop-blur-xl border-t border-line max-h-[40vh] overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            {legs.map((leg, i) => (
              <div key={`${leg.selection}-${leg.marketType}`} className="flex items-center justify-between gap-3 bg-panel rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">{i + 1}</span>
                    <span className="text-sm font-bold text-ink truncate">{leg.selection}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted font-bold">{leg.marketType}</span>
                    {leg.home && leg.away && (
                      <span className="text-[10px] text-muted">{leg.away} @ {leg.home}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono font-bold text-primary">
                    {leg.price > 0 ? `+${leg.price}` : leg.price}
                  </span>
                  <span className="text-xs text-muted">{Math.round(leg.fairProb * 100)}%</span>
                  <button
                    onClick={() => removeLeg(leg.selection, leg.marketType)}
                    className="size-6 rounded-full bg-line hover:bg-red-500/20 flex items-center justify-center text-muted hover:text-red-400 transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="bg-obsidian border-t border-primary/30 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: expand toggle + leg count */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm"
          >
            {expanded ? <ChevronDown className="size-4 text-muted" /> : <ChevronUp className="size-4 text-muted" />}
            <span className="font-bold text-ink">{label}</span>
            <span className="text-xs text-muted">·</span>
            <span className="font-mono font-bold text-primary text-lg">{american}</span>
          </button>

          {/* Right: payout + clear */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted">AI Prob</p>
              <p className={cn("text-sm font-mono font-bold",
                probPct >= 55 ? "text-emerald-400" : probPct >= 40 ? "text-amber-400" : "text-red-400"
              )}>
                {probPct}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted">$10 Pays</p>
              <p className="text-sm font-mono font-bold text-ink">
                ${(10 * decPayout).toFixed(2)}
              </p>
            </div>
            <button
              onClick={clearAll}
              className="size-8 rounded-lg bg-line hover:bg-red-500/15 flex items-center justify-center text-muted hover:text-red-400 transition-colors"
              title="Clear all"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
