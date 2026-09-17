import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Beaker, Flame, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/picks")({ component: TheLab });

function TheLab() {
  const { picks, snapshot } = useDeskDecision();
  const props = picks?.props || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <Beaker className="size-8 text-primary" />
          The Lab
        </h1>
        <p className="text-muted text-sm">
          Raw player props scanned and evaluated by SportsLock AI. Look for Syndicate Badges.
        </p>
      </div>

      <div className="grid gap-4">
        {props.map((p, i) => {
          const playerName = p.player || p.row?.player;
          const selection = playerName ? p.selection.replace(playerName, '').trim() : p.selection;
          const priceStr = p.price != null ? (p.price > 0 ? `+${p.price}` : p.price) : '';
          
          return (
            <div key={i} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border border-line bg-panel hover:border-primary/50 transition-colors shadow-sm">
              <div className="flex flex-col mb-3 md:mb-0">
                {playerName ? (
                  <>
                    <span className="font-bold text-lg text-ink">{playerName}</span>
                    <span className="text-sm font-medium text-ink/80">{selection}</span>
                  </>
                ) : (
                  <span className="font-bold text-lg text-ink">{p.selection}</span>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{p.row?.marketType} • {p.sport}</span>
                  {priceStr && <span className="text-[10px] px-1.5 py-0.5 rounded bg-line text-ink font-mono">{priceStr}</span>}
                </div>
                
                {p.why && p.why.includes("[ALPHA]") && (
                  <div className="mt-2 flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary w-fit uppercase tracking-wider">
                    <Flame className="size-3" />
                    Syndicate Edge
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Confidence</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-24 bg-line rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${Math.min(100, Math.max(0, (p.row?.fairProb ?? 0) * 100))}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold font-mono">
                      {Math.round((p.row?.fairProb ?? 0) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Value (EV)</span>
                  <span className={cn("text-lg font-bold font-mono", (p.score ?? 0) > 0 ? "text-primary" : "text-ink")}>
                    {((p.score ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
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