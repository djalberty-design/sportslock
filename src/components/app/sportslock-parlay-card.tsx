import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Flame, BarChart2, X, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { classifyMix } from "@/lib/market/feed-mix";
import { matchSnapshotEvent, resolveLegTeam } from "@/lib/market/logos";
import { FeedLockModal } from "./feed-lock-modal";

function TeamMark({ src, name }: { src: string | null; name: string }) {
  const letter = (name || "?").replace(/^(the)\s+/i, "").charAt(0).toUpperCase() || "?";
  return (
    <span className="relative size-8 shrink-0">
      <span className="absolute inset-0 rounded-full bg-line ring-2 ring-panel flex items-center justify-center text-[11px] font-bold text-muted">{letter}</span>
      {src ? (
        <img
          src={src}
          alt={name}
          className="relative size-8 rounded-full ring-2 ring-panel bg-white object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

function displaySelection(leg: any, teams: { homeName?: string; awayName?: string; side?: string }) {
  const sel = String(leg?.selection || "").trim();
  if (!sel) return teams.homeName || "Pick";
  if (/^(over|under)\s/i.test(sel) || /\b[ouO]\s?\d/.test(sel)) return sel;
  if (sel.length <= 4 && teams.side === "home" && teams.homeName) return teams.homeName;
  if (sel.length <= 4 && teams.side === "away" && teams.awayName) return teams.awayName;
  return sel;
}

export function SportsLockParlayCard({ parlay, snapshot }: { parlay: any; snapshot?: any }) {
  const [wager, setWager] = useState("10");
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
  const rawInsight = pick?.why || parlayCand?.reason || "AI Simulation favors this combination based on heavily correlated game scripts and player usage rates.";
  const aiInsight = rawInsight.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

  const firstLeg = legs[0];
  const firstHit = matchSnapshotEvent(snapshot, firstLeg);
  const firstQuote = firstHit.quote;
  const firstBrief = firstHit.brief;
  const firstTeams = resolveLegTeam(firstLeg, firstQuote);
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
              <TeamMark src={awayLogo} name={firstTeams.awayName || "Away"} />
              <TeamMark src={homeLogo} name={firstTeams.homeName || "Home"} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-ink leading-tight">
                {firstTeams.awayName || firstLeg?.away || "Away"} at {firstTeams.homeName || firstLeg?.home || "Home"}
              </span>
              <span className="text-[10px] text-muted flex items-center gap-2">
                {firstQuote?.start ? new Date(firstQuote.start).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) : "TODAY"}
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
            const hit = matchSnapshotEvent(snapshot, leg);
            const legQuote = hit.quote;
            const teams = resolveLegTeam(leg, legQuote);
            const isSharp = (legQuote?.handlePct || 0) - (legQuote?.ticketPct || 0) >= 15;
            return (
              <div key={i} className="flex items-start gap-3 relative">
                {isSharp && (
                  <div className="absolute -left-1.5 top-0 z-10">
                    <Flame className="size-4 text-orange-500 fill-orange-500/20" />
                  </div>
                )}
                <div className="flex items-center -space-x-2 shrink-0 mt-0.5">
                  <TeamMark src={teams.awayLogo} name={teams.awayName || "Away"} />
                  <TeamMark src={teams.homeLogo} name={teams.homeName || "Home"} />
                </div>
                <div className="flex flex-col w-full min-w-0">
                  <div className="text-sm flex items-start justify-between w-full gap-2">
                    <span className="font-bold text-ink leading-tight">{displaySelection(leg, teams)}</span>
                    <span className="text-muted text-xs uppercase tracking-wider font-bold shrink-0">{leg.marketType} </span>
                  </div>
                  <div className="text-muted text-[11px] mt-0.5 leading-tight">{teams.matchup}</div>
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
                     const hit = matchSnapshotEvent(snapshot, leg);
                     const teams = resolveLegTeam(leg, hit.quote);
                     return (
                       <div key={i} className="bg-obsidian border border-line rounded-xl p-4 flex flex-col gap-3">
                         <div className="flex items-start gap-3">
                           <div className="flex items-center -space-x-2 shrink-0">
                             <TeamMark src={teams.awayLogo} name={teams.awayName || "Away"} />
                             <TeamMark src={teams.homeLogo} name={teams.homeName || "Home"} />
                           </div>
                           <div className="flex flex-col min-w-0">
                             <span className="font-bold text-ink text-lg leading-tight">{displaySelection(leg, teams)}</span>
                             <span className="text-xs font-bold text-muted">{leg.marketType} &bull; {teams.matchup}</span>
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

      <FeedLockModal
        key={isModalOpen ? "open" : "shut"}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        parlay={parlay}
        snapshot={snapshot}
        americanOdds={americanOdds}
      />
    </>
  );
}
