import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Flame, Zap, BarChart2, X, ChevronRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { classifyMix } from "@/lib/market/feed-mix";
import { resolveLegTeam, resolveTeamLogo } from "@/lib/market/logos";
import { cn } from "@/lib/utils";

export function SportsLockParlayCard({ parlay, snapshot, onTail }: { parlay: any; snapshot?: any; onTail?: () => void }) {
  const [wager, setWager] = useState("50");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const pick = parlay;
  const parlayCand = pick?.parlay || pick;
  const legs = parlayCand?.legs || [];
  
  const fairDec = parlayCand?.combinedFair ? (1 / parlayCand.combinedFair).toFixed(2) : "0.00";
  const payoutDec = (pick?.decimalPayout || parlayCand?.decimalPayout) 
    ? (pick?.decimalPayout || parlayCand?.decimalPayout).toFixed(2) 
    : fairDec;
  
  const decPayout = parseFloat(payoutDec);
  const americanOdds = decPayout >= 2.0 
    ? `+${Math.round((decPayout - 1) * 100)}`
    : `-${Math.round(100 / (decPayout - 1))}`;

  const numWager = parseFloat(wager || "0");
  const totalPayout = (numWager * decPayout).toFixed(2);
  const rawInsight = pick?.why || parlayCand?.reason || "AI Simulation favors this combination based on heavily correlated game scripts and player usage rates.";
  const aiInsight = rawInsight.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  
  const firstLeg = legs[0];
  const firstQuote = snapshot?.quotes?.find((q: any) => q.eventId === firstLeg?.eventId);
  const firstBrief = snapshot?.briefs?.find((b: any) => b.eventId === firstLeg?.eventId);
  const firstTeams = resolveLegTeam(firstLeg, firstQuote);
  const homeAbbrResolved = firstTeams.homeAbbr;
  const awayAbbrResolved = firstTeams.awayAbbr;
  const homeLogo = firstTeams.homeLogo;
  const awayLogo = firstTeams.awayLogo;
  const isLive = firstQuote?.inPlay;
  const mix = classifyMix(pick);

  const combinedEv = parlayCand?.combinedEv || 0;
  const combinedProb = Math.round((1 / (parseFloat(fairDec) || 2)) * 100);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-sm flex flex-col cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setIsSheetOpen(true)}
      >
        <div className="flex items-center justify-between mb-4 border-b border-line/50 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2">
              {awayLogo ? <img src={awayLogo} className="size-8 rounded-full ring-2 ring-panel" alt={awayAbbrResolved || firstTeams.awayName || "Away"} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <div className="size-8 rounded-full bg-line ring-2 ring-panel" />}
              {homeLogo ? <img src={homeLogo} className="size-8 rounded-full ring-2 ring-panel" alt={homeAbbrResolved || firstTeams.homeName || "Home"} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <div className="size-8 rounded-full bg-line ring-2 ring-panel" />}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                {awayAbbrResolved || firstLeg?.away || "AWAY"} @ {homeAbbrResolved || firstLeg?.home || "HOME"}
              </span>
              <span className="text-[10px] text-muted flex items-center gap-2">
                {firstQuote?.start ? new Date(firstQuote.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "TODAY"}
                {firstBrief?.weather && <span>&bull; {firstBrief.weather.replace(/[^\x20-\x7E]/g, "").trim()}</span>}
              </span>
            </div>
          </div>
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest">LIVE</span>
            </div>
          ) : (
            <div className="text-lg font-bold text-primary font-mono">{americanOdds}</div>
          )}
        </div>

        <div className="mb-4 bg-obsidian rounded-lg p-2.5 border border-line/30 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
            <span className="flex items-center gap-1"><BarChart2 className="size-3 text-primary" /> AI Matchup Projection</span>
            <span className="text-primary">{combinedProb}% HIT PROB</span>
          </div>
          <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full relative" style={{ width: `${combinedProb}%` }}>
              <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="text-ink font-display font-bold text-base mb-3 flex items-center gap-2 flex-wrap">
          {legs.length}-Leg Parlay
          <span className="text-muted text-[10px] font-mono uppercase tracking-wider bg-obsidian px-1.5 py-0.5 rounded border border-line">{mix.label}</span>
          <span className="text-primary text-xs font-mono bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">+{Math.round(combinedEv * 100)}% EDGE</span>
        </div>

        <div className="mb-4 flex-1 space-y-4">
          {legs.map((leg: any, i: number) => {
            const legQuote = snapshot?.quotes?.find((q: any) => q.eventId === leg.eventId && q.selection === leg.selection) || snapshot?.quotes?.find((q: any) => q.eventId === leg.eventId);
            const teams = resolveLegTeam(leg, legQuote);
            const logo = teams.selectionLogo || resolveTeamLogo(leg.sport || teams.sport, { name: leg.selection });
            const isSharp = (legQuote?.handlePct || 0) - (legQuote?.ticketPct || 0) >= 15;
            
            return (
              <div key={i} className="flex items-start gap-3 relative">
                {isSharp && (
                  <div className="absolute -left-1.5 top-0 z-10">
                    <Flame className="size-4 text-orange-500 fill-orange-500/20" />
                  </div>
                )}
                
                {legQuote?.headshot ? (
                   <div className="relative size-8 shrink-0">
                     <img src={legQuote.headshot} className="size-8 rounded-full object-cover ring-1 ring-line bg-obsidian" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                     {logo && <img src={logo} className="absolute -bottom-1 -right-1 size-4 rounded-full ring-1 ring-panel bg-white object-contain" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                   </div>
                ) : logo ? (
                  <img src={logo} className="size-7 object-contain shrink-0 mt-0.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="size-7 rounded-full bg-line shrink-0 mt-0.5" />
                )}
                
                <div className="flex flex-col w-full">
                  <div className="text-sm flex items-start justify-between w-full">
                    <span className="font-bold text-ink leading-tight">{leg.selection} </span>
                    <span className="text-muted text-xs uppercase tracking-wider font-bold ml-2 shrink-0">{leg.marketType} </span>
                  </div>
                  <div className="text-muted text-[10px] mt-0.5">{teams.awayAbbr || teams.awayName || "AWAY"} @ {teams.homeAbbr || teams.homeName || "HOME"}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-2 mb-4 p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs text-primary/90 italic border-l-2 border-l-primary">
          "{aiInsight}"
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(true);
          }}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-between group"
        >
          <span>Lock It In</span>
          <span className="font-mono text-sm group-hover:scale-105 transition-transform">
            ${wager} pays ${(numWager * decPayout).toFixed(2)}
          </span>
        </button>
      </motion.div>

      <AnimatePresence>
        {isSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm" onClick={() => setIsSheetOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-[90dvh] sm:h-auto sm:max-h-[85dvh] max-w-2xl bg-panel sm:border border-line sm:rounded-2xl shadow-2xl flex flex-col rounded-t-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-line flex items-center justify-between bg-obsidian">
                <div className="flex flex-col">
                  <h3 className="font-display font-bold text-xl text-ink">Deep Dive Analysis</h3>
                  <span className="text-xs text-muted font-mono">{legs.length}-Leg Parlay &bull; {americanOdds}</span>
                </div>
                <button onClick={() => setIsSheetOpen(false)} className="p-2 hover:bg-panel rounded-full transition-colors"><X className="size-6 text-muted" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                 <div className="flex flex-col gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                   <div className="flex items-center gap-2 text-primary font-bold">
                     <CheckCircle2 className="size-5" /> AI Consensus: High Value
                   </div>
                   <p className="text-sm text-ink/90 leading-relaxed">{aiInsight}</p>
                 </div>

                 <h4 className="font-bold text-sm uppercase tracking-wider text-muted border-b border-line pb-2 mt-4">Leg-by-Leg Metrics</h4>
                 <div className="flex flex-col gap-4">
                   {legs.map((leg: any, i: number) => {
                     const legQuote = snapshot?.quotes?.find((q: any) => q.eventId === leg.eventId && q.selection === leg.selection) || snapshot?.quotes?.find((q: any) => q.eventId === leg.eventId);
                     const teams = resolveLegTeam(leg, legQuote);
                     const chance = Number(leg?.chance ?? legQuote?.fairProb ?? pick?.chance);
                     const legProb = Number.isFinite(chance) && chance > 0 && chance < 1
                       ? Math.round(chance * 100)
                       : (Number.isFinite(chance) && chance >= 1 && chance <= 99 ? Math.round(chance) : null);
                     const book = Number(legQuote?.price ?? leg?.price);
                     const implied = Number.isFinite(book) && book !== 0
                       ? (book < 0 ? (-book / (-book + 100)) : (100 / (book + 100)))
                       : null;
                     const legVegas = implied != null ? Math.round(implied * 100) : null;
                     const legEdge = legProb != null && legVegas != null ? (legProb - legVegas).toFixed(1) : null;
                     const isSharp = (legQuote?.handlePct || 0) - (legQuote?.ticketPct || 0) >= 15;

                     return (
                       <div key={i} className="bg-obsidian border border-line rounded-xl p-4 flex flex-col gap-4">
                         <div className="flex items-start justify-between">
                           <div className="flex items-start gap-3">
                             {teams.selectionLogo ? (
                               <img src={teams.selectionLogo} className="size-8 object-contain shrink-0" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                             ) : (
                               <div className="size-8 rounded-full bg-line shrink-0" />
                             )}
                             <div className="flex flex-col">
                               <span className="font-bold text-ink text-lg">{leg.selection}</span>
                               <span className="text-xs font-bold uppercase tracking-wider text-muted">{leg.marketType} &bull; {teams.awayAbbr || teams.awayName || "AWAY"} @ {teams.homeAbbr || teams.homeName || "HOME"}</span>
                             </div>
                           </div>
                           {isSharp && (
                             <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20">
                               <Flame className="size-3 text-orange-500" />
                               <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Sharp Money</span>
                             </div>
                           )}
                         </div>

                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                             <span className="flex items-center gap-1"><BarChart2 className="size-3 text-primary" /> Win Probability</span>
                             <span className="text-primary font-mono">{legProb != null ? `${legProb}%` : "Looked"}</span>
                           </div>
                           <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
                             <div className="h-full bg-primary rounded-full relative" style={{ width: `${legProb ?? 0}%` }} />
                           </div>
                         </div>

                         <div className="grid grid-cols-3 gap-2 mt-1">
                           <div className="flex flex-col items-center justify-center bg-panel border border-line rounded-lg py-2">
                             <span className="text-[9px] uppercase tracking-wider text-muted font-bold">Vegas</span>
                             <span className="font-mono text-ink text-sm">{legVegas != null ? `${legVegas}%` : "\u2014"}</span>
                           </div>
                           <div className="flex flex-col items-center justify-center bg-panel border border-line rounded-lg py-2">
                             <span className="text-[9px] uppercase tracking-wider text-muted font-bold">AI</span>
                             <span className="font-mono text-ink text-sm">{legProb != null ? `${legProb}%` : "Looked"}</span>
                           </div>
                           <div className="flex flex-col items-center justify-center bg-primary/10 border border-primary/30 rounded-lg py-2">
                             <span className="text-[9px] uppercase tracking-wider text-primary font-bold">Edge</span>
                             <span className="font-mono text-primary text-sm">{legEdge == null ? "\u2014" : parseFloat(legEdge) > 0 ? `+${legEdge}%` : `${legEdge}%`}</span>
                           </div>
                         </div>

                       </div>
                     );
                   })}
                 </div>
              </div>
              
              <div className="p-4 sm:p-6 bg-obsidian border-t border-line">
                <button 
                  onClick={() => {
                    setIsSheetOpen(false);
                    setTimeout(() => setIsModalOpen(true), 300);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
                >
                  <ShieldCheck className="size-5" /> Proceed to Lock In
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-line flex items-center justify-between">
                <h3 className="font-display font-bold text-lg flex items-center gap-2"><ShieldCheck className="text-primary size-5" /> Ledger Confirmation</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-obsidian rounded-full transition-colors"><X className="size-5 text-muted" /></button>
              </div>
              
              <div className="p-6">
                 <p className="text-sm text-muted mb-4">Edit to precisely match Hard Rock odds before saving.</p>
                 <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted">Final Odds (American)</label>
                      <input type="text" defaultValue={americanOdds} className="w-full bg-obsidian border border-line rounded-lg px-4 py-3 text-ink font-mono focus:outline-none focus:border-primary" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted">Wager Amount ($)</label>
                      <div className="flex gap-2">
                        <input type="number" value={wager} onChange={(e) => setWager(e.target.value)} className="w-full bg-obsidian border border-line rounded-lg px-4 py-3 text-ink font-mono focus:outline-none focus:border-primary text-lg" />
                        <button className="shrink-0 bg-primary/10 text-primary border border-primary/20 px-4 rounded-lg font-bold text-xs flex flex-col items-center justify-center hover:bg-primary/20 transition-colors">
                           <span>SMART</span>
                           <span>WAGER</span>
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
              
              <div className="p-4 bg-obsidian border-t border-line">
                <button 
                  onClick={() => {
                    if (onTail) onTail();
                    setIsModalOpen(false);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Save to SportsLock Ledger <ChevronRight className="size-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
