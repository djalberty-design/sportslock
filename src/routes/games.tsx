import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { Activity, LayoutGrid, Clock, CloudRain } from "lucide-react";
import { cn } from "@/lib/utils";
import { espnLogoUrl } from "@/lib/market/logos";

export const Route = createFileRoute("/games")({ component: TheMatrix });

function TheMatrix() {
  const { scan, snapshot } = useDeskDecision();
  
  // Group by game using the underlying snapshot briefs/quotes
  const gamesMap = new Map();
  snapshot?.briefs?.forEach((b: any) => {
    gamesMap.set(b.eventId, { 
      sport: b.sport || "GAME", 
      home: b.home || "Home", 
      away: b.away || "Away",
      homeAbbr: b.homeAbbr,
      awayAbbr: b.awayAbbr, 
      weather: b.weather,
      eventId: b.eventId
    });
  });

  // Attach live quotes data to each game
  snapshot?.quotes?.forEach((q: any) => {
    if (gamesMap.has(q.eventId)) {
      const g = gamesMap.get(q.eventId);
      g.inPlay = q.inPlay;
      g.homeScore = q.homeScore ?? 0;
      g.awayScore = q.awayScore ?? 0;
      g.period = q.period;
      g.clock = q.clock;
      g.start = q.start;
      g.sport = q.sport || g.sport;
      g.homeAbbr = q.homeAbbr || g.homeAbbr;
      g.awayAbbr = q.awayAbbr || g.awayAbbr;
      g.home = q.home || g.home;
      g.away = q.away || g.away;
      gamesMap.set(q.eventId, g);
    } else {
      gamesMap.set(q.eventId, {
        eventId: q.eventId,
        sport: q.sport || "GAME",
        home: q.home || "Home",
        away: q.away || "Away",
        homeAbbr: q.homeAbbr,
        awayAbbr: q.awayAbbr,
        inPlay: q.inPlay,
        homeScore: q.homeScore ?? 0,
        awayScore: q.awayScore ?? 0,
        period: q.period,
        clock: q.clock,
        start: q.start,
      });
    }
  });

  const games = Array.from(gamesMap.values());

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
        {games.map(g => {
          const startTime = g.start ? new Date(g.start).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : "Upcoming";
          
          return (
            <div key={g.eventId} className="rounded-xl border border-line bg-panel p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Activity className="size-16" />
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-muted uppercase tracking-widest">{g.sport}</span>
                {g.inPlay ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 border border-red-500/30">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex size-2 rounded-full bg-red-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Live</span>
                  </div>
                ) : g.weather ? (
                  <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                    <CloudRain className="size-3" />
                    {g.weather}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted">{startTime}</span>
                )}
              </div>
              
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex justify-between items-center text-lg font-display font-bold text-ink">
                  <div className="flex items-center gap-3">
                    {g.awayAbbr && <img src={espnLogoUrl(g.sport || "MLB", g.awayAbbr) || ""} alt="" className="size-8 object-contain" />}
                    <span>{g.away}</span>
                  </div>
                  {g.inPlay ? (
                    <span className="text-primary font-mono text-2xl">{g.awayScore}</span>
                  ) : (
                    <span className="text-muted text-sm mx-4">@</span>
                  )}
                </div>
                <div className="flex justify-between items-center text-lg font-display font-bold text-ink">
                  <div className="flex items-center gap-3">
                    {g.homeAbbr && <img src={espnLogoUrl(g.sport || "MLB", g.homeAbbr) || ""} alt="" className="size-8 object-contain" />}
                    <span>{g.home}</span>
                  </div>
                  {g.inPlay && (
                    <span className="text-primary font-mono text-2xl">{g.homeScore}</span>
                  )}
                </div>
              </div>

              {g.inPlay && g.period != null && (
                <div className="mt-4 flex items-center gap-1 text-xs text-primary font-bold uppercase tracking-wider">
                  <Clock className="size-3" />
                  <span>Q{g.period} {g.clock ? `• ${g.clock}` : ""}</span>
                </div>
              )}

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
          );
        })}
        {games.length === 0 && (
          <div className="col-span-full text-center p-12 text-muted border border-dashed border-line rounded-xl">
            No games currently on the board.
          </div>
        )}
      </div>
    </div>
  );
}