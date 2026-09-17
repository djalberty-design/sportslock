import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, Flame, BarChart2 } from "lucide-react";
import { espnLogoUrl } from "@/lib/market/logos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/picks")({
  component: TheLab,
});

function TheLab() {
  const { picks } = useDeskDecision();
  const props = picks?.props || [];

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          The Lab <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 tracking-normal uppercase">Player Props</span>
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {props.map((p, i) => {
          const playerName = p.player || p.row?.player;
          const selection = playerName ? p.selection.replace(playerName, '').trim() : p.selection;
          const headshotUrl = (p.row as any)?.headshot;
          
          const teamAbbr = p.row?.homeAbbr || p.row?.awayAbbr;
          const teamLogo = (p.row as any)?.homeLogo || (p.row as any)?.awayLogo || (teamAbbr ? espnLogoUrl(p.sport || "MLB", teamAbbr) : null);
          
          // Calculate Odds (Robust fallback)
          let pAm = "";
          let rawP = p.row?.hardRockPrice || p.row?.consensusPrice || p.price;
          if (rawP && (rawP < -100 || rawP > 100)) {
            pAm = rawP > 0 ? `+${rawP}` : `${rawP}`;
          } else {
            const d = p.decimalPayout || 2.0;
            pAm = d >= 2.0 ? `+${Math.round((d - 1) * 100)}` : `-${Math.round(100 / (d - 1))}`;
          }
          const priceStr = pAm;
          
          // AI Simulation Stats
          const edgeVal = (p.score ?? 0) * 100;
          const hitProb = Math.round((p.chance || 0.55) * 100);
          const isSharp = (p.row?.handlePct || 0) - (p.row?.ticketPct || 0) >= 15;
          const vegasImplied = Math.round((1 / (p.decimalPayout || 2)) * 100);

          return (
            <div key={p.id} className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 hover:border-primary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer">
              
              {/* Left Side: Matchup & Player Context */}
              <div className="flex items-center gap-4">
                {isSharp && (
                  <div className="absolute top-0 right-0 z-10 bg-orange-500/10 px-2 py-1 rounded-bl-lg border-l border-b border-orange-500/20 flex items-center gap-1">
                    <Flame className="size-3 text-orange-500 fill-orange-500/20" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-orange-500">Sharp</span>
                  </div>
                )}
                
                <div className="relative shrink-0">
                  {headshotUrl ? (
                    <div className="relative size-12 md:size-14">
                      <img src={headshotUrl} className="size-full rounded-full object-cover ring-2 ring-line bg-obsidian z-10 relative" alt={playerName || ""} />
                      {teamLogo && (
                        <img src={teamLogo} className="absolute -bottom-1 -right-1 size-6 rounded-full ring-2 ring-panel bg-white object-contain z-20" alt="" />
                      )}
                    </div>
                  ) : teamLogo ? (
                    <img src={teamLogo} className="size-12 md:size-14 object-contain rounded-full ring-2 ring-line bg-white/5 p-1" alt="" />
                  ) : (
                    <div className="size-12 md:size-14 rounded-full bg-line ring-2 ring-line flex items-center justify-center">
                      <Target className="size-6 text-muted opacity-50" />
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col">
                  {playerName ? (
                    <>
                      <span className="text-sm md:text-base font-bold text-ink">{playerName}</span>
                      <span className="text-muted text-sm">{selection}</span>
                    </>
                  ) : (
                    <span className="font-bold text-base text-ink">{p.selection}</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{p.row?.marketType} &bull; {p.sport}</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">&bull; {p.row?.awayAbbr || p.away || "AWAY"} @ {p.row?.homeAbbr || p.home || "HOME"}</span>
                  </div>
                </div>
              </div>

              {/* Middle: AI Analytics (WagerMeter & Delta) */}
              <div className="flex-1 max-w-xs hidden lg:flex flex-col gap-2 px-4 border-l border-line">
                 <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                   <span className="flex items-center gap-1"><BarChart2 className="size-3 text-primary" /> AI Prob</span>
                   <span className="text-primary">{hitProb}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
                   <div className="h-full bg-primary rounded-full relative" style={{ width: `${hitProb}%` }}></div>
                 </div>
                 <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-muted font-mono">Vegas: {vegasImplied}%</span>
                    <span className="text-[9px] text-primary font-mono border border-primary/20 bg-primary/10 px-1 rounded">Delta: +{edgeVal.toFixed(1)}%</span>
                 </div>
              </div>

              {/* Right Side: Metrics & Button */}
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:w-32 border-t border-line md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0">
                <button className="flex items-center justify-center w-full md:w-auto min-w-[80px] h-11 px-4 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary hover:text-primary-foreground text-primary transition-colors">
                  <span className="text-sm font-bold font-mono">{priceStr}</span>
                </button>
              </div>
            </div>
          );
        })}
        {props.length === 0 && (
          <div className="text-center p-10 text-muted border border-dashed border-line rounded-xl">
            <Target className="size-8 mx-auto mb-3 opacity-50" />
            No active props found in The Lab right now.
          </div>
        )}
      </div>
    </div>
  );
}