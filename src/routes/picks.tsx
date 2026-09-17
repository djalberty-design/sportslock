import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { espnLogoUrl } from "@/lib/market/logos";

export const Route = createFileRoute("/picks")({ component: TheLab });

function TheLab() {
  const { picks } = useDeskDecision();
  const props = picks?.props || [];

  const formatAm = (dec: number) => {
    if (!dec || dec < 1.01) return "";
    return dec >= 2.0 ? `+${Math.round((dec - 1) * 100)}` : `-${Math.round(100 / (dec - 1))}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          Player Props
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {props.map((p, i) => {
          const playerName = p.player || p.row?.player;
          const selection = playerName ? p.selection.replace(playerName, '').trim() : p.selection;
          
          // Calculate Odds
                      // Calculate Odds (Robust fallback)
            let pAm = "";
            let rawP = p.row?.hardRockPrice || p.row?.consensusPrice || p.price;
            if (rawP && rawP < -100 || rawP > 100) {
              pAm = rawP > 0 ? `+${rawP}` : `${rawP}`;
            } else {
              const d = p.decimalPayout || 2.0;
              pAm = d >= 2.0 ? `+${Math.round((d - 1) * 100)}` : `-${Math.round(100 / (d - 1))}`;
            }
            const priceStr = pAm;
          
          const teamAbbr = p.row?.homeAbbr || p.row?.awayAbbr;
          const teamLogo = (p.row as any)?.homeLogo || (p.row as any)?.awayLogo || (teamAbbr ? espnLogoUrl(p.sport || "MLB", teamAbbr) : null);
          
          // Player Headshot fallback support
          const headshotUrl = (p.row as any)?.headshot; 

          return (
            <div key={i} className="flex flex-col md:flex-row items-center justify-between p-4 rounded-xl border border-line bg-panel hover:border-primary/50 transition-colors shadow-sm gap-4">
              
              {/* Left Side: Avatar + Player Info */}
              <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                <div className="relative shrink-0">
                  {headshotUrl ? (
                    <img src={headshotUrl} className="size-14 rounded-full object-cover bg-obsidian border border-line" alt={playerName} />
                  ) : teamLogo ? (
                    <div className="size-14 rounded-full bg-background border border-line flex items-center justify-center p-2">
                      <img src={teamLogo} className="size-full object-contain" alt="" />
                    </div>
                  ) : (
                    <div className="size-14 rounded-full bg-line" />
                  )}
                  {teamLogo && headshotUrl && (
                    <img src={teamLogo} className="absolute -bottom-1 -right-1 size-5 object-contain bg-panel rounded-full p-0.5 border border-line" alt="" />
                  )}
                </div>
                
                <div className="flex flex-col">
                  {playerName ? (
                    <>
                      <span className="font-bold text-lg text-ink leading-tight">{playerName}</span>
                      <span className="text-sm font-medium text-ink/80">{selection}</span>
                    </>
                  ) : (
                    <span className="font-bold text-lg text-ink">{p.selection}</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{p.row?.marketType} Ã¢â‚¬Â¢ {p.sport}</span>
                  </div>
                </div>
              </div>

              {/* Middle: Badges */}
              {p.why && p.why.includes("[ALPHA]") && (
                <div className="hidden md:flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                  <Flame className="size-3" />
                  Syndicate Edge
                </div>
              )}

              {/* Right Side: Metrics & Button */}
              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <div className="flex flex-col items-end px-4 border-r border-line">
                  <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Value (EV)</span>
                  <span className={cn("text-base font-bold font-mono", (p.score ?? 0) > 0 ? "text-primary" : "text-ink")}>
                    {((p.score ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <button className="flex flex-col items-center justify-center min-w-[80px] h-12 bg-panel border border-primary/50 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors group">
                  <span className="text-sm font-bold">{priceStr}</span>
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