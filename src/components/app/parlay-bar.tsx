import { useParlaySlip, combinedOdds } from "@/lib/parlay-slip";
import { cn } from "@/lib/utils";
import { X, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

export function ParlayBar() {
  const { legs, removeLeg, clearAll } = useParlaySlip();
  const [expanded, setExpanded] = useState(false);

  if (legs.length === 0) return null;

  const { american, decPayout, combinedProb } = combinedOdds(legs);
  const probPct = Math.round(combinedProb * 100);
  const isSingle = legs.length === 1;
  const label = isSingle ? "BET" : `${legs.length}L`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-2 duration-200">
      {/* Expanded leg list */}
      {expanded && (
        <div className="bg-obsidian/95 backdrop-blur-xl border-t border-line max-h-[35vh] overflow-y-auto">
          <div className="max-w-2xl mx-auto px-3 py-2 space-y-1">
            {legs.map((leg, i) => (
              <div key={`${leg.selection}-${leg.marketType}`} className="flex items-center justify-between gap-2 bg-panel rounded px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded font-bold shrink-0">{i + 1}</span>
                  <span className="text-xs font-bold text-ink truncate">{leg.selection}</span>
                  <span className="text-[9px] text-muted uppercase shrink-0">{leg.marketType}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-mono font-bold text-primary">
                    {leg.price > 0 ? `+${leg.price}` : leg.price}
                  </span>
                  <button
                    onClick={() => removeLeg(leg.selection, leg.marketType)}
                    className="size-5 rounded-full bg-line hover:bg-red-500/20 flex items-center justify-center text-muted hover:text-red-400"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compact bar — single thin row */}
      <div className="bg-obsidian/95 backdrop-blur-sm border-t border-primary/40">
        <div className="max-w-2xl mx-auto px-3 h-9 flex items-center justify-between gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5"
          >
            {expanded ? <ChevronDown className="size-3 text-muted" /> : <ChevronUp className="size-3 text-muted" />}
            <span className="text-xs font-bold text-ink">{label}</span>
            <span className="font-mono font-bold text-primary text-sm">{american}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <span className={cn("text-[10px] font-mono font-bold",
              probPct >= 55 ? "text-emerald-400" : probPct >= 40 ? "text-amber-400" : "text-red-400"
            )}>
              {probPct}%
            </span>
            <span className="text-[10px] font-mono text-ink">
              ${(10 * decPayout).toFixed(0)}
            </span>
            <button
              onClick={clearAll}
              className="size-5 rounded bg-line/50 hover:bg-red-500/15 flex items-center justify-center text-muted hover:text-red-400"
              title="Clear all"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
