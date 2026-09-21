import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Target, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";
import { useState, useEffect, useMemo } from "react";
import { getAllEnrichedPropsFn } from "@/lib/market/server";

export const Route = createFileRoute("/picks")({
  component: TheLab,
});

function TheLab() {
  const { picks } = useDeskDecision();
  const scanProps = picks?.props || [];
  const sportFilter = useDeskStore((s) => s.sportFilter);

  // Load all enriched props from DB cache (single query, no quota)
  const [cachedProps, setCachedProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getAllEnrichedPropsFn()
      .then((res) => {
        if (res.ok && res.props) setCachedProps(res.props);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge: cached props + scan props (deduplicate by selection)
  const mergedProps = useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const p of cachedProps) {
      const key = p.selection;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    for (const p of scanProps) {
      const key = p.selection;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    // Sort by AI edge (best value first), then by probability
    return result.sort((a, b) => {
      const aEdge = a.aiEdge ?? (a.score || 0);
      const bEdge = b.aiEdge ?? (b.score || 0);
      if (bEdge !== aEdge) return bEdge - aEdge;
      return (b.aiProb || b.chance || 0) - (a.aiProb || a.chance || 0);
    });
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

      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      <div className="flex flex-col gap-3">
        {loading && (
          <div className="text-center p-10 text-muted">
            <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            Loading AI picks...
          </div>
        )}
        {!loading && props.map((p, i) => {
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

          const initials = playerName ? playerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";

          // Market type label
          const mktLabel = (p.marketType || "").replace(/^player_/, "").replace(/_/g, " ");

          return (
            <div key={`${p.selection}-${i}`} className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 hover:border-primary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {teamPos && <span className="text-[10px] uppercase tracking-wider text-muted/60">{teamPos}</span>}
                    <span className="text-[10px] text-muted/40">{mktLabel}</span>
                    <span className="text-[10px] text-muted/40">{p.away || ""} @ {p.home || ""}</span>
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
                  <span className={cn("text-[9px] font-mono px-1 rounded", edgeVal > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                    Edge: {edgeVal > 0 ? "+" : ""}{edgeVal.toFixed(1)}%
                  </span>
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
        {!loading && props.length === 0 && (
          <div className="text-center p-10 text-muted border border-dashed border-line rounded-xl">
            <Target className="size-8 mx-auto mb-3 opacity-50" />
            <p>No active props found in The Lab right now.</p>
            <p className="text-xs mt-2 text-muted/60">Pull player props from a game's matchup page to populate AI picks here.</p>
          </div>
        )}
      </div>
    </div>
  );
}