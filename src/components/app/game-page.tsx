import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, BarChart2, ShieldCheck, X, Camera, CloudSun } from "lucide-react";
import { useDeskDecision } from "@/lib/market/use-board";
import { espnLogoUrl } from "@/lib/market/logos";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function GamePage({ eventId }: { eventId: string }) {
  const { snapshot, picks } = useDeskDecision();
  const [activeTab, setActiveTab] = useState("popular");
  const [sgpSlip, setSgpSlip] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wager, setWager] = useState("50");

  const gameQuotes = useMemo(() => snapshot?.quotes?.filter((q: any) => q.eventId === eventId) || [], [snapshot, eventId]);
  const firstQuoteRef = gameQuotes[0];
  
            const gameProps = useMemo(() => {
    const allProps = picks?.props || [];
    
    // Strict Match: Only return props that belong to this EXACT eventId
    const fromPicks = allProps.filter((p: any) => p.eventId === eventId || p.row?.eventId === eventId);
    const fromQuotes = snapshot?.quotes?.filter((q: any) => q.eventId === eventId && (q.isProp || !["ml", "spread", "total"].includes(q.marketType))) || [];
    
    const combined = [...fromQuotes, ...fromPicks];
    const unique: any[] = [];
    const seen = new Set();
    for (const p of combined) {
      const key = p.selection + (p.marketType || "");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }
    return unique;
  }, [picks, snapshot, eventId]);

  const gameBrief = useMemo(() => snapshot?.briefs?.find((b: any) => b.eventId === eventId), [snapshot, eventId]);
  
  if (gameQuotes.length === 0 && gameProps.length === 0) {
    return <div className="p-8 text-center text-muted">Game not found or loading...</div>;
  }

  const firstQuote = gameQuotes[0] || gameProps[0]?.row || gameProps[0];
  const homeLogo = firstQuote?.homeLogo || espnLogoUrl(firstQuote?.sport || "MLB", firstQuote?.homeAbbr);
  const awayLogo = firstQuote?.awayLogo || espnLogoUrl(firstQuote?.sport || "MLB", firstQuote?.awayAbbr);
  const isLive = firstQuote?.inPlay;

  const toggleLeg = (quote: any) => {
    setSgpSlip(prev => {
      const exists = prev.find(p => p.selection === quote.selection && (p.marketType === quote.marketType || p.id === quote.id));
      if (exists) return prev.filter(p => p !== exists);
      return [...prev, quote];
    });
  };

  const isSelected = (quote: any) => !!sgpSlip.find(p => p.selection === quote.selection && (p.marketType === quote.marketType || p.id === quote.id));

  // Fast Frontend Math
  const combinedProb = sgpSlip.length > 0 ? sgpSlip.reduce((acc, leg) => acc * (leg.fairProb || leg.chance || 0.5), 1) : 0;
  const hitProbPct = Math.round(combinedProb * 100);

  const vegasImplied = sgpSlip.length > 0 ? sgpSlip.reduce((acc, leg) => {
      let p = leg.hardRockPrice || leg.consensusPrice || leg.price || leg.row?.hardRockPrice || -110;
      let prob = p < 0 ? (-p / (-p + 100)) : (100 / (p + 100));
      return acc * prob;
  }, 1) : 0;
  const vegasPct = Math.round(vegasImplied * 100);
  const edgeVal = (hitProbPct - vegasPct).toFixed(1);
  
  let decPayout = 1 / (vegasImplied || 0.5);
  let americanOdds = decPayout >= 2.0 
    ? `+${Math.round((decPayout - 1) * 100)}`
    : `-${Math.round(100 / (decPayout - 1))}`;
  if (sgpSlip.length === 0) americanOdds = "";

    const renderGrid = (type: string) => {
    let items: any[] = [];
    const lines = gameQuotes.filter((q: any) => q.marketType === "spread" || q.marketType === "total" || q.marketType === "ml");
    
    if (type === "popular") items = [...lines.slice(0, 4), ...gameProps.slice(0, 6)];
    else if (type === "props") items = gameProps;
    else if (type === "lines") items = lines;

    return (
      <div className="flex flex-col gap-3 pb-24">
        {items.map((q, i) => {
          let amOdds = "";
          let rawP = q.hardRockPrice || q.consensusPrice || q.price || q.row?.hardRockPrice;
          if (rawP && (rawP < -100 || rawP > 100)) amOdds = rawP > 0 ? `+${rawP}` : `${rawP}`;
          else {
             const d = (q.fairProb) ? (1/q.fairProb) : (q.decimalPayout || 2.0);
             amOdds = d >= 2.0 ? `+${Math.round((d - 1) * 100)}` : `-${Math.round(100 / (d - 1))}`;
          }
          
          const label = q.player || q.row?.player ? q.selection.replace(q.player || q.row?.player, "").trim() : q.selection;
          const playerName = q.player || q.row?.player;
          const pointText = q.point ? (q.point > 0 ? `+${q.point}` : q.point) : "";
          const headshotUrl = (q.row as any)?.headshot;

          return (
            <div key={i} className="bg-panel border border-line rounded-lg p-3 flex items-center justify-between hover:border-primary/30 transition-colors">
               <div className="flex items-center gap-3">
                  {headshotUrl && (
                    <div className="shrink-0 size-10">
                      <img src={headshotUrl} className="size-full rounded-full object-cover ring-1 ring-line bg-obsidian" alt={playerName || ""} />
                    </div>
                  )}
                  <div className="flex flex-col">
                     {playerName ? (
                       <>
                         <span className="font-bold text-ink text-sm">{playerName}</span>
                         <span className="text-muted text-xs">{label} {pointText}</span>
                       </>
                     ) : (
                       <span className="font-bold text-ink text-sm">{label} {pointText}</span>
                     )}
                     <span className="text-[10px] uppercase tracking-wider text-muted font-bold mt-1">{q.marketType || q.row?.marketType}</span>
                  </div>
               </div>
               <button 
                 onClick={() => toggleLeg(q)}
                 className={cn("flex flex-col items-center justify-center min-w-[70px] h-10 rounded-md border transition-colors", 
                   isSelected(q) ? "bg-primary border-primary text-primary-foreground" : "bg-obsidian border-line text-primary hover:border-primary/50"
                 )}
               >
                 <span className="font-mono text-sm font-bold">{amOdds}</span>
               </button>
            </div>
          )
        })}
        {items.length === 0 && (
          <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
            No markets available in this category.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto animate-in fade-in duration-500 min-h-dvh relative bg-background">
      
      {/* Header */}
      <div className="sticky top-0 sm:top-7 z-40 bg-background/95 backdrop-blur border-b border-line px-4 pt-4 pb-0">
        <Link to="/games" className="inline-flex items-center text-sm font-bold text-primary mb-4 hover:underline">
          <ChevronLeft className="size-4 mr-1" /> Back to Matchups
        </Link>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <div className="flex items-center -space-x-3">
                {awayLogo ? <img src={awayLogo} className="size-12 rounded-full ring-4 ring-background bg-panel object-contain" alt="" /> : <div className="size-12 rounded-full bg-line ring-4 ring-background" />}
                {homeLogo ? <img src={homeLogo} className="size-12 rounded-full ring-4 ring-background bg-panel object-contain" alt="" /> : <div className="size-12 rounded-full bg-line ring-4 ring-background" />}
             </div>
             <div className="flex flex-col">
                <span className="text-xl font-display font-bold text-ink">{firstQuote?.awayAbbr || "AWAY"} @ {firstQuote?.homeAbbr || "HOME"}</span>
                <span className="text-xs text-muted flex items-center gap-1 mt-0.5">
                  {gameBrief?.weather && <CloudSun className="size-3" />}
                  {gameBrief?.weather ? gameBrief.weather.replace(/[^\x20-\x7E]/g, "").trim() : "Dome"} &bull; {firstQuote?.start ? new Date(firstQuote.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Upcoming"}
                </span>
             </div>
          </div>
          {isLive && (
             <div className="flex flex-col items-end">
               <span className="font-mono text-2xl font-bold text-ink">{firstQuote.awayScore} - {firstQuote.homeScore}</span>
               <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">LIVE</span>
             </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-line/0">
           {["popular", "lines", "props"].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn("pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap", activeTab === tab ? "text-primary" : "text-muted hover:text-ink")}
              >
                 {tab === "lines" ? "Game Lines" : tab === "props" ? "Player Props" : tab}
                 {activeTab === tab && <motion.div layoutId="sgptab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
           ))}
        </div>
      </div>

      <div className="p-4">
        {renderGrid(activeTab)}
      </div>

      {/* Dynamic SGP Ticker (Fixed Bottom) */}
      <AnimatePresence>
        {sgpSlip.length > 0 && (
          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 z-50 md:left-64 p-4 pointer-events-none"
          >
             <div className="max-w-4xl mx-auto bg-obsidian border border-primary/30 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 pointer-events-auto">
                <div className="flex flex-col flex-1 w-full">
                   <div className="flex items-center justify-between mb-1.5">
                     <span className="text-xs font-bold uppercase tracking-wider text-muted">{sgpSlip.length}-Leg SGP <span className="text-primary ml-2">{americanOdds}</span></span>
                     <span className="text-xs font-bold text-primary font-mono">{hitProbPct}% PROB</span>
                   </div>
                   <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
                     <div className="h-full bg-primary rounded-full relative transition-all duration-300" style={{ width: `${hitProbPct}%` }}>
                       <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
                     </div>
                   </div>
                   <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-muted">
                     <span>Vegas Implied: {vegasPct}%</span>
                     <span className="text-primary bg-primary/10 px-1 rounded">Delta: {parseFloat(edgeVal) > 0 ? `+${edgeVal}` : edgeVal}%</span>
                   </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button className="flex-1 md:w-12 h-12 bg-panel border border-line rounded-lg flex items-center justify-center text-muted hover:text-ink transition-colors" title="Magic Scan (Screenshot)">
                    <Camera className="size-5" />
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex-1 md:w-40 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Lock It In
                  </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock It In Modal */}
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
                        <button className="shrink-0 bg-primary/10 text-primary border border-primary/20 px-4 rounded-lg font-bold text-xs flex flex-col items-center justify-center hover:bg-primary/20 transition-colors group">
                           <span className="group-hover:scale-105 transition-transform">SMART</span>
                           <span className="group-hover:scale-105 transition-transform">WAGER</span>
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
              
              <div className="p-4 bg-obsidian border-t border-line">
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setSgpSlip([]);
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

    </div>
  );
}