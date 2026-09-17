import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Activity, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/games")({ component: TheMatrix });

function TheMatrix() {
  const { scan } = useDeskDecision();
  const rows = scan?.rows || [];
  
  // Group by game
  const gamesMap = new Map();
  rows.forEach(r => {
    if (!gamesMap.has(r.eventId)) {
      gamesMap.set(r.eventId, { sport: r.sport, home: r.home, away: r.away, start: r.start });
    }
  });

  const games = Array.from(gamesMap.entries()).map(([id, data]) => ({ id, ...data }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <LayoutGrid className="size-8 text-primary" />
          The Matrix
        </h1>
        <p className="text-muted text-sm">
          Monte Carlo simulations and game script projections for upcoming matchups.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {games.map(g => (
          <div key={g.id} className="rounded-xl border border-line bg-panel p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Activity className="size-16" />
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted uppercase tracking-widest">{g.sport}</span>
            </div>
            
            <div className="flex justify-between items-center text-lg font-display font-bold text-ink">
              <span>{g.away}</span>
              <span className="text-muted text-sm mx-4">@</span>
              <span>{g.home}</span>
            </div>

            <div className="mt-6 pt-4 border-t border-line/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Monte Carlo Projection</span>
                <span className="font-bold text-primary">Simulating Scripts...</span>
              </div>
              <div className="h-1 w-full bg-line mt-2 rounded-full overflow-hidden flex">
                <div className="h-full bg-primary/80" style={{ width: '45%' }} title="Shootout"></div>
                <div className="h-full bg-blue-500/80" style={{ width: '35%' }} title="Normal"></div>
                <div className="h-full bg-rose-500/80" style={{ width: '20%' }} title="Blowout"></div>
              </div>
            </div>
          </div>
        ))}
        {games.length === 0 && (
          <div className="col-span-full text-center p-12 text-muted border border-dashed border-line rounded-xl">
            No games currently on the board.
          </div>
        )}
      </div>
    </div>
  );
}