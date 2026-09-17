import { motion } from "framer-motion";
import { Zap, Activity, Hexagon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApexParlayCard({ parlay, onTail }: { parlay: any; onTail?: () => void }) {
  // Mocking the structure based on the engine.ts outputs
  const legs = parlay?.legs || [];
  const fairDec = parlay?.combinedFair ? (1 / parlay.combinedFair).toFixed(2) : "0.00";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-apex-glow"
    >
      {/* Top Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
          <Hexagon className="size-4 fill-primary/20" />
          <span className="text-xs font-bold tracking-widest uppercase">Apex AI Gold Ribbon</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-muted">
          <Activity className="size-3" />
          <span>Fair Odds: {fairDec}x</span>
        </div>
      </div>

      {/* Rationale / Note */}
      {parlay.scoreNote && (
        <p className="mb-4 text-sm leading-relaxed text-ink/90">
          <span className="font-semibold text-primary">AI Insight: </span>
          {parlay.scoreNote}
        </p>
      )}

      {/* The Legs */}
      <div className="mb-5 space-y-2">
        {legs.map((leg: any, i: number) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-background p-3 border border-line/50">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink">{leg.selection}</span>
              <span className="text-xs text-muted">{leg.marketType.toUpperCase()} • {leg.sport}</span>
            </div>
            {leg.badge && (
              <div className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Zap className="size-3" />
                {leg.badge}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Button */}
      <button 
        onClick={onTail}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
      >
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        <span>Tail on Hard Rock</span>
        <ChevronRight className="size-4" />
      </button>
    </motion.div>
  );
}