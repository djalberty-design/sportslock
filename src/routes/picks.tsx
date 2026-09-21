import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, Flame, BarChart2 } from "lucide-react";
import { espnLogoUrl } from "@/lib/market/logos";
import { cn } from "@/lib/utils";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import { useState, useEffect, useMemo } from "react";
import { getCachedPropsFn } from "@/lib/market/server";

export const Route = createFileRoute("/picks")({
  component: TheLab,
});

function TheLab() {
  const { picks, snapshot } = useDeskDecision();
  const scanProps = picks?.props || [];
  const sportFilter = useDeskStore((s) => s.sportFilter);

  // Load on-demand cached props from all games with cached data
  const [cachedProps, setCachedProps] = useState<any[]>([]);
  useEffect(() => {
    async function loadCachedProps() {
      const events = snapshot?.quotes?.filter((q: any) => q.isProp || q.cachedProps)
        || [];
      // Get unique events that might have cached props
      const gameIds = new Set<string>();
      for (const q of snapshot?.quotes || []) {
        if (q.eventId?.startsWith("oddsapi-")) gameIds.add(q.eventId);
      }
      // Also check the brief list for games
      for (const b of snapshot?.briefs || []) {
        if (b.eventId?.startsWith("oddsapi-")) gameIds.add(b.eventId);
      }
      if (gameIds.size === 0) return;

      const allProps: any[] = [];
      for (const eventId of gameIds) {
        const sportKey = eventId.includes("-NFL-") ? "americanfootball_nfl"
          : eventId.includes("-NCAAF-") ? "americanfootball_ncaaf"
          : eventId.includes("-MLB-") ? "baseball_mlb"
          : eventId.includes("-NBA-") ? "basketball_nba"
          : eventId.includes("-NHL-") ? "icehockey_nhl"
          : eventId.includes("-NCAAB-") ? "basketball_ncaab"
          : "";
        if (!sportKey) continue;
        try {
          const res = await getCachedPropsFn({ data: { sportKey, eventId } });
          if (res.ok && res.props) {
            allProps.push(...res.props);
          }
        } catch {}
      }
      setCachedProps(allProps);
    }
    loadCachedProps();
  }, [snapshot]);

  // Merge: scan props + cached props (deduplicate by selection)
  const mergedProps = useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];
    // Prioritize cached (enriched) props
    for (const p of cachedProps) {
      const key = p.selection;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    // Add scan props that aren't duplicates
    for (const p of scanProps) {
      const key = p.selection;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    // Sort by AI edge (best value first)
    return result.sort((a, b) => (b.aiEdge || b.score || 0) - (a.aiEdge || a.score || 0));
  }, [cachedProps, scanProps]);

  const allProps = mergedProps;
  const props = applySportFilter(allProps, sportFilter);
  const liveSports = [...new Set(allProps.map((p: any) => p.sport).filter(Boolean))];

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          The Lab <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 tracking-normal uppercase">AI Picks</span>
        </h1>
        {allProps.length > 0 && (
          <p className="text-sm text-muted">{allProps.length} player props analyzed · Sorted by AI edge</p>
        )}
      </div>

      {/* Sport Filter */}
      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      <div className="flex flex-col gap-3">
        {props.map((p, i) => {
          const playerName = p.player || p.row?.player;
          const selection = playerName ? p.selection.replace(playerName, '').trim() : p.selection;
          const headshotUrl = p.headshot || (p.row as any)?.headshot;
          const teamPos = [p.team, p.position].filter(Boolean).join(" · ");
          
          // Odds
          const rawP = p.price || p.row?.hardRockPrice || p.row?.consensusPrice || -110;
          const pAm = rawP > 0 ? `+${rawP}` : `${rawP}`;
          
          // AI Probability
          const aiProb = p.aiProb ?? p.chance ?? p.fairProb ?? 0.5;
          const hitProb = Math.round(aiProb * 100);
          const hasAi = p.aiProb != null;
          const implied = rawP < 0 ? Math.abs(rawP) / (Math.abs(rawP) + 100) : 100 / (rawP + 100);
          const vegasImplied = Math.round(implied * 100);
          const edgeVal = p.aiEdge ? p.aiEdge * 100 : (p.score ?? 0) * 100;
          const isSharp = (p.row?.handlePct || 0) - (p.row?.ticketPct || 0) >= 15;

          // Initials fallback
          const initials = playerName ? playerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";

          return (
            <div key={`${p.selection}-${i}`} className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 hover:border-primary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Sharp badge */}
              {isSharp && (
                <div className="absolute top-0 right-0 z-10 bg-orange-500/10 px-2 py-1 rounded-bl-lg border-l border-b border-orange-500/20 flex items-center gap-1">
                  <Flame className="size-3 text-orange-500 fill-orange-500/20" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-orange-500">Sharp</span>
                </div>
              )}
              
              {/* Player info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {headshotUrl ? (
                  <img src={headshotUrl} className="size-11 rounded-full object-cover ring-2 ring-line bg-obsidian shrink-0" alt={playerName || ""} />
                ) : initials ? (
                  <div className="size-11 rounded-full bg-line ring-2 ring-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-muted">{initials}</span>
                  </div>
                ) : (
                  <div className="size-11 rounded-full bg-line ring-2 ring-line flex items-center justify-center shrink-0">
                    <Target className="size-5 text-muted opacity-50" />
                  </div>
                )}
                
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-ink truncate">{playerName || p.selection}</span>
                  {playerName && <span className="text-xs text-muted truncate">{selection}</span>}
                  <div className="flex items-center gap-2 mt-0.5">
                    {teamPos && <span className="text-[10px] uppercase tracking-wider text-muted/60">{teamPos}</span>}
                    <span className="text-[10px] text-muted/40">{p.away || "AWAY"} @ {p.home || "HOME"}</span>
                  </div>
                </div>
              </div>

              {/* AI Analytics */}
              <div className="flex flex-col gap-1.5 md:max-w-[200px] md:px-4 md:border-l md:border-line w-full md:w-auto">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                  <span className="flex items-center gap-1">
                    <BarChart2 className="size-3 text-primary" />
                    {hasAi ? "AI Prediction" : "Implied"}
                  </span>
                  <span className={cn(hitProb >= 55 ? "text-emerald-400" : hitProb >= 45 ? "text-amber-400" : "text-red-400")}>
                    {hasAi && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 rounded px-1 mr-1 font-bold">AI</span>}
                    {hitProb}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", hitProb >= 55 ? "bg-emerald-500" : hitProb >= 45 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${hitProb}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted font-mono">Vegas: {vegasImplied}%</span>
                  <span className={cn("text-[9px] font-mono px-1 rounded", edgeVal > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>Edge: {edgeVal > 0 ? "+" : ""}{edgeVal.toFixed(1)}%</span>
                </div>
              </div>

              {/* Odds button */}
              <div className="flex items-center gap-2 shrink-0">
                <button className="flex items-center justify-center min-w-[80px] h-10 px-4 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary hover:text-primary-foreground text-primary transition-colors">
                  <span className="text-sm font-bold font-mono">{pAm}</span>
                </button>
              </div>
            </div>
          );
        })}
        {props.length === 0 && (
          <div className="text-center p-10 text-muted border border-dashed border-line rounded-xl">
            <Target className="size-8 mx-auto mb-3 opacity-50" />
            <p>No active props found in The Lab right now.</p>
            <p className="text-xs mt-2">Pull player props from a game's matchup page to populate AI picks.</p>
          </div>
        )}
      </div>
    </div>
  );
}