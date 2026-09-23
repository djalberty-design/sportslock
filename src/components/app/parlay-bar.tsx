import { useParlaySlip, combinedOdds } from "@/lib/parlay-slip";
import { cn } from "@/lib/utils";
import { X, Trash2, ChevronUp, ChevronDown, Lock, ExternalLink } from "lucide-react";
import { useState, useCallback } from "react";
import { useDeskStore } from "@/lib/desk-store";
import { lockPredictionFn } from "@/lib/market/server";
import { getHardRockUrl } from "@/lib/market/hard-rock-links";

export function ParlayBar() {
  const { legs, removeLeg, clearAll } = useParlaySlip();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const placePaper = useDeskStore((s) => s.placePaperTicket);

  const handleLockIn = useCallback(async () => {
    if (legs.length === 0 || saving) return;
    setSaving(true);
    try {
      const legData = legs.map(q => ({
        eventId: q.eventId || "",
        selection: q.selection,
        marketType: q.marketType || "unknown",
        point: q.point,
        price: q.price || -110,
        fairProb: q.fairProb || 0.5,
      }));

      // Build description
      const desc = legData.length === 1
        ? `${legData[0].selection} (${legData[0].marketType})`
        : `${legData.length}-leg parlay: ${legData.map(l => l.selection).join(" + ")}`;

      // Calculate combined odds
      const combinedPrice = legData.length === 1
        ? legData[0].price
        : legData.reduce((acc, l) => {
            const dec = l.price > 0 ? (l.price / 100) + 1 : (100 / Math.abs(l.price)) + 1;
            return acc * dec;
          }, 1);
      const americanCombined = legData.length === 1
        ? legData[0].price
        : (combinedPrice >= 2 ? Math.round((combinedPrice - 1) * 100) : Math.round(-100 / (combinedPrice - 1)));

      // Add to local paper tickets (shows in My Action)
      placePaper({
        kind: legData.length === 1 ? "main" : "parlay",
        description: desc,
        stake: 50,
        price: americanCombined,
        status: "open",
        gameIds: [...new Set(legData.map(l => l.eventId))],
        chance: legData.reduce((acc, l) => acc * l.fairProb, 1),
        home: legs[0]?.home || "",
        away: legs[0]?.away || "",
        fastLog: true,
        ...(legData.length === 1 ? {
          point: (legData[0] as any).point ?? undefined,
          marketType: (legData[0] as any).marketType ?? undefined,
        } : {}),
      });

      // Also log to server (prediction_logs for self-improvement)
      await lockPredictionFn({ data: { legs: legData } });

      setSaved(true);
      setTimeout(() => {
        clearAll();
        setSaved(false);
      }, 1200);
    } catch (e) {
      console.error("Lock-in error:", e);
    }
    setSaving(false);
  }, [legs, saving, placePaper, clearAll]);

  if (legs.length === 0) return null;

  const { american, decPayout, combinedProb, isCorrelated } = combinedOdds(legs);
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
        <div className="max-w-2xl mx-auto px-3 h-10 flex items-center justify-between gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5"
          >
            {expanded ? <ChevronDown className="size-3 text-muted" /> : <ChevronUp className="size-3 text-muted" />}
            <span className="text-xs font-bold text-ink">{label}</span>
            {isCorrelated && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-tight">
                ⚡ SGP
              </span>
            )}
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

            {/* Hard Rock Bet Deep Link */}
            <a
              href={getHardRockUrl(legs[0]?.sport)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-all shrink-0"
              title="Open in Hard Rock Bet"
            >
              <span>HR Bet</span>
              <ExternalLink className="size-2.5" />
            </a>

            {/* Lock It In button */}
            <button
              onClick={handleLockIn}
              disabled={saving || saved}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                saved
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 active:scale-95",
                saving && "opacity-50"
              )}
            >
              <Lock className="size-3" />
              {saved ? "Locked!" : saving ? "..." : "Lock In"}
            </button>

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
