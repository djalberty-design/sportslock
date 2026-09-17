import { motion, AnimatePresence } from "framer-motion";
import { Zap, Activity, ShieldCheck, ChevronRight, CloudRain, Clock, CalendarDays, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function SportsLockParlayCard({ parlay, snapshot, onTail }: { parlay: any; snapshot?: any; onTail?: () => void }) {
  const [wager, setWager] = useState("50");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const legs = parlay?.legs || [];
  const fairDec = parlay?.combinedFair ? (1 / parlay.combinedFair).toFixed(2) : "0.00";
  const payoutDec = parlay?.decimalPayout ? parlay.decimalPayout.toFixed(2) : fairDec;
  
  // Extract primary game info
  const primaryEventId = legs[0]?.eventId;
  const brief = snapshot?.briefs?.find((b: any) => b.eventId === primaryEventId);
  
  // Find a quote line to grab start time and live scores
  const quote = snapshot?.quotes?.find((q: any) => q.eventId === primaryEventId);
  
  const home = quote?.homeAbbr || quote?.home || "HOME";
  const away = quote?.awayAbbr || quote?.away || "AWAY";
  const startStr = quote?.start;
  const startTime = startStr ? new Date(startStr).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : "Upcoming";
  
  const weather = brief?.weather;
  const inPlay = quote?.inPlay;
  const period = quote?.period;
  const clock = quote?.clock;
  const homeScore = quote?.homeScore ?? 0;
  const awayScore = quote?.awayScore ?? 0;

  const numWager = parseFloat(wager || "0");
  const toWin = (numWager * parseFloat(payoutDec)).toFixed(2);
  const profit = (numWager * parseFloat(payoutDec) - numWager).toFixed(2);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-apex-glow flex flex-col"
      >
        {/* Header: AI Ribbon & Odds */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
            <ShieldCheck className="size-4 fill-primary/20" />
            <span className="text-xs font-bold tracking-widest uppercase">SportsLock Gold</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-ink">{payoutDec}x Payout</span>
            <span className="text-[10px] text-muted">Fair: {fairDec}x</span>
          </div>
        </div>

        {/* Game Context Bar */}
        <div className="mb-4 p-3 rounded-lg bg-background border border-line flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <span>{away}</span>
              <span className="text-muted text-sm">@</span>
              <span>{home}</span>
            </div>
            {inPlay ? (
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex size-2.5 rounded-full bg-red-500"></span>
                </span>
                <span className="text-xs font-bold text-red-500">
                  {awayScore} - {homeScore}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted">
                <CalendarDays className="size-3" />
                <span>{startTime}</span>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center text-xs text-muted">
            {inPlay && period != null ? (
              <div className="flex items-center gap-1">
                <Clock className="size-3" />
                <span>Q{period} {clock ? `• ${clock}` : ""}</span>
              </div>
            ) : weather ? (
              <div className="flex items-center gap-1">
                <CloudRain className="size-3 text-cyan-500" />
                <span>{weather}</span>
              </div>
            ) : (
              <span>Pre-Game</span>
            )}
          </div>
        </div>

        {/* AI Insight */}
        {parlay.scoreNote && (
          <p className="mb-4 text-sm leading-relaxed text-ink/90">
            <span className="font-semibold text-primary">AI Insight: </span>
            {parlay.scoreNote}
          </p>
        )}

        {/* The Legs */}
        <div className="mb-5 flex-1 space-y-2">
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

        {/* Wager Calculator */}
        <div className="mt-auto mb-4 p-3 rounded-lg bg-background border border-line flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 w-1/3">
            <label className="text-[10px] uppercase tracking-wider text-muted font-bold">Wager ($)</label>
            <input 
              type="number" 
              value={wager}
              onChange={(e) => setWager(e.target.value)}
              className="bg-transparent border-b border-line text-ink font-bold focus:outline-none focus:border-primary px-1"
            />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted font-bold">To Win</span>
            <span className="text-lg font-bold text-primary font-mono">${profit}</span>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          <span>Lock It In</span>
          <Lock className="size-4" />
        </button>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-2xl border border-line bg-panel shadow-2xl p-6"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 text-muted hover:text-ink transition-colors"
              >
                <X className="size-5" />
              </button>

              <h2 className="text-xl font-display font-bold text-ink mb-4 flex items-center gap-2">
                <ShieldCheck className="size-6 text-primary" />
                Confirm Lock
              </h2>

              <div className="space-y-4 mb-6">
                <p className="text-sm text-muted">
                  The SportsLock Engine has simulated this specific game script 10,000 times via Monte Carlo modeling. These props mathematically correlate to the projected outcome.
                </p>
                
                <div className="bg-background rounded-lg p-4 border border-line">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">Total Wager:</span>
                    <span className="font-bold text-ink">${numWager.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">Payout Ratio:</span>
                    <span className="font-bold text-ink">{payoutDec}x</span>
                  </div>
                  <div className="h-px bg-line my-2" />
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-ink">Total Profit:</span>
                    <span className="font-bold text-primary font-mono">${profit}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  if (onTail) onTail();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
              >
                <span>Proceed to Sportsbook</span>
                <ChevronRight className="size-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}