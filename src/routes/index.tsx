import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { SportsLockParlayCard } from "@/components/app/sportslock-parlay-card";
import { Sparkles, Activity } from "lucide-react";

export const Route = createFileRoute("/")({ component: SportsLockCommandCenter });

function SportsLockCommandCenter() {
  const { picks, snapshot } = useDeskDecision();
  
  const topParlays = picks?.ribbon?.slice(0, 5) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <Sparkles className="size-8 text-primary" />
          SportsLock AI Feed
        </h1>
        <p className="text-muted text-sm">
          The AI has scanned the board. Here are the most mathematically sound correlations today.
        </p>
      </div>

      {topParlays.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-line rounded-xl">
          <Activity className="size-8 text-muted mb-3" />
          <p className="text-ink font-medium">No Gold Ribbon Parlays currently detected.</p>
          <p className="text-muted text-sm mt-1">SportsLock AI is waiting for more sportsbook data.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topParlays.map((p, i) => (
            <SportsLockParlayCard key={i} parlay={p} snapshot={snapshot} onTail={() => alert("Redirecting to Hard Rock FL...")} />
          ))}
        </div>
      )}
    </div>
  );
}