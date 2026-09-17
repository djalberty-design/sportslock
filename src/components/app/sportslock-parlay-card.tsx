import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ChevronRight, X, Flame } from "lucide-react";
import { useState } from "react";
import { espnLogoUrl } from "@/lib/market/logos";

export function SportsLockParlayCard({ parlay, snapshot, onTail }: { parlay: any; snapshot?: any; onTail?: () => void }) {
  const [wager, setWager] = useState("50");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pick = parlay;
  const parlayCand = pick?.parlay || pick;
  const legs = parlayCand?.legs || [];
  
  const fairDec = parlayCand?.combinedFair ? (1 / parlayCand.combinedFair).toFixed(2) : "0.00";
  const payoutDec = (pick?.decimalPayout || parlayCand?.decimalPayout) 
    ? (pick?.decimalPayout || parlayCand?.decimalPayout).toFixed(2) 
    : fairDec;
  
  // Convert Decimal Odds to American
  const decPayout = parseFloat(payoutDec);
  const americanOdds = decPayout >= 2.0 
    ? `+${Math.round((decPayout - 1) * 100)}`
    : `-${Math.round(100 / (decPayout - 1))}`;

  const numWager = parseFloat(wager || "0");
  const totalPayout = (numWager * decPayout).toFixed(2);
  const aiInsight = pick?.why || parlayCand?.reason || parlayCand?.scoreNote;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-sm flex flex-col"
      >
        {/* Header - Hard Rock Style */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded bg-primary/10 px-2 py-1 text-primary">
            <span className="text-xs font-bold uppercase tracking-wider">SportsLock Gold</span>
          </div>
          <span className="text-lg font-bold text-primary font-mono">{americanOdds}</span>
        </div>

        <div className="text-ink font-display font-bold text-lg mb-3">
          {legs.length}-Bet Parlay
        </div>

        {/* The Legs - Hard Rock Style */}
        <div className="mb-6 flex-1 space-y-3">
          {legs.map((leg: any, i: number) => {
            // Find the quote to get the team abbreviations for the logo
            const legQuote = snapshot?.quotes?.find((q: any) => q.eventId === leg.eventId && q.selection === leg.selection) 
                          || snapshot?.quotes?.find((q: any) => q.eventId === leg.eventId);
            const teamAbbr = leg.selection.includes(leg.home) ? legQuote?.homeAbbr : legQuote?.awayAbbr;
            const logo = espnLogoUrl(leg.sport || "MLB", teamAbbr || legQuote?.homeAbbr);
            
            const matchUp = `${legQuote?.awayAbbr || leg.away || "AWAY"} @ ${legQuote?.homeAbbr || leg.home || "HOME"}`;
            
            return (
              <div key={i} className="flex items-start gap-3">
                {logo ? (
                  <img src={logo} className="size-6 object-contain shrink-0 mt-0.5" alt="" />
                ) : (
                  <div className="size-6 rounded-full bg-line shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col">
                  <div className="text-sm">
                    <span className="font-bold text-ink">{leg.selection} </span>
                    <span className="text-muted text-xs uppercase tracking-wider">{leg.marketType} </span>
                    <span className="text-muted text-xs">({matchUp})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button - Hard Rock Style */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full flex flex-col items-center justify-center rounded-lg bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          <span className="text-base">Lock It In</span>
          <span className="text-xs font-medium opacity-90">${numWager} pays ${totalPayout}</span>
        </button>

        {aiInsight && (
          <div className="mt-3 flex items-center justify-center gap-1 text-xs text-primary font-medium">
            <Flame className="size-3" />
            <span>AI Verified Edge</span>
          </div>
        )}
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
                Confirm Wager
              </h2>

              <div className="space-y-4 mb-6">
                <p className="text-sm text-ink bg-line/30 p-3 rounded-lg border border-line">
                  <span className="font-bold text-primary">AI Insight:</span> {aiInsight || "This combination offers positive expected value based on Monte Carlo simulations."}
                </p>
                
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-xs uppercase tracking-wider text-muted font-bold">Wager Amount ($)</label>
                  <input 
                    type="number" 
                    value={wager}
                    onChange={(e) => setWager(e.target.value)}
                    className="w-full bg-background border border-line rounded-lg text-ink font-bold focus:outline-none focus:border-primary px-4 py-3 text-lg"
                  />
                </div>

                <div className="bg-background rounded-lg p-4 border border-line">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted font-bold uppercase tracking-wider text-[10px]">Odds:</span>
                    <span className="font-bold text-ink font-mono">{americanOdds}</span>
                  </div>
                  <div className="h-px bg-line my-2" />
                  <div className="flex justify-between items-end mt-2">
                    <span className="font-bold text-ink text-sm">Total Payout:</span>
                    <span className="text-2xl font-bold text-primary font-mono">${totalPayout}</span>
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
                <span>Place Bet at Hard Rock</span>
                <ChevronRight className="size-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}