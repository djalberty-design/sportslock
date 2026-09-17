import { createFileRoute } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { LayoutGrid, ChevronRight } from "lucide-react";
import { espnLogoUrl } from "@/lib/market/logos";

export const Route = createFileRoute("/games")({ component: TheMatrix });

function TheMatrix() {
  const { snapshot } = useDeskDecision();
  
  // Group by game using the underlying snapshot briefs/quotes
  const gamesMap = new Map<string, any>();
  snapshot?.briefs?.forEach((b: any) => {
    gamesMap.set(b.eventId, { 
      sport: b.sport || "GAME", 
      home: b.home || "Home", 
      away: b.away || "Away",
      homeAbbr: b.homeAbbr,
      awayAbbr: b.awayAbbr, 
      weather: b.weather,
      eventId: b.eventId,
      start: b.start,
      markets: {}
    });
  });

  // Attach live quotes data and populate markets
  snapshot?.quotes?.forEach((q: any) => {
    let g = gamesMap.get(q.eventId);
    if (!g) {
      g = {
        eventId: q.eventId, sport: q.sport || "GAME", home: q.home || "Home", away: q.away || "Away",
        homeAbbr: q.homeAbbr, awayAbbr: q.awayAbbr, start: q.start,
        markets: {}
      };
    }
    
    // Fill out live info
    g.inPlay = q.inPlay;
    g.homeScore = q.homeScore ?? g.homeScore ?? 0;
    g.awayScore = q.awayScore ?? g.awayScore ?? 0;
    
    // Assign markets based on QuoteLine data
    if (q.marketType === 'ml') {
      if (q.selection === q.home || q.selection === q.homeAbbr) g.markets.homeML = q.price;
      else g.markets.awayML = q.price;
    } else if (q.marketType === 'spread') {
      if (q.selection === q.home || q.selection === q.homeAbbr) g.markets.homeSpread = { point: q.point, price: q.price };
      else g.markets.awaySpread = { point: q.point, price: q.price };
    } else if (q.marketType === 'total') {
      if (q.side === 'over') g.markets.over = { point: q.point, price: q.price };
      else if (q.side === 'under') g.markets.under = { point: q.point, price: q.price };
    }

    gamesMap.set(q.eventId, g);
  });

  const games = Array.from(gamesMap.values());

  const formatAm = (dec: number) => dec >= 2.0 ? `+${Math.round((dec - 1) * 100)}` : `-${Math.round(100 / (dec - 1))}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-6 border-b border-line pb-4">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <LayoutGrid className="size-8 text-primary" />
          Matchups
        </h1>
      </div>

      <div className="flex flex-col gap-8">
        {games.map(g => {
          const startTime = g.start ? new Date(g.start).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : "Upcoming";
          
          return (
            <div key={g.eventId} className="flex flex-col border-b border-line pb-6">
              
              {/* Header Titles for Markets */}
              <div className="flex mb-3">
                <div className="w-[40%]"></div>
                <div className="w-[60%] flex text-[10px] font-bold text-muted uppercase tracking-wider text-center">
                  <div className="flex-1">Spread</div>
                  <div className="flex-1">Total</div>
                  <div className="flex-1">Winner</div>
                </div>
              </div>

              {/* Grid Content */}
              <div className="flex">
                {/* Left Column: Teams */}
                <div className="w-[40%] flex flex-col justify-between py-1 pr-4">
                  
                  {/* Away Team */}
                  <div className="flex items-center gap-3 h-12">
                    {g.awayAbbr ? <img src={espnLogoUrl(g.sport || "MLB", g.awayAbbr) || ""} className="size-8 object-contain" alt="" /> : <div className="size-8 rounded-full bg-line" />}
                    <span className="text-base font-medium text-ink truncate">{g.away}</span>
                  </div>

                  {/* Home Team */}
                  <div className="flex items-center gap-3 h-12 mt-2">
                    {g.homeAbbr ? <img src={espnLogoUrl(g.sport || "MLB", g.homeAbbr) || ""} className="size-8 object-contain" alt="" /> : <div className="size-8 rounded-full bg-line" />}
                    <span className="text-base font-medium text-ink truncate">{g.home}</span>
                  </div>
                </div>

                {/* Right Column: Odds Grid */}
                <div className="w-[60%] flex gap-2">
                  
                  {/* SPREAD Column */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-12 flex flex-col items-center justify-center bg-panel rounded border border-line">
                      <span className="text-sm font-bold text-ink">{g.markets?.awaySpread?.point ? (g.markets.awaySpread.point > 0 ? `+${g.markets.awaySpread.point}` : g.markets.awaySpread.point) : "-"}</span>
                      <span className="text-xs font-bold text-primary">{g.markets?.awaySpread?.price ? formatAm(g.markets.awaySpread.price) : ""}</span>
                    </div>
                    <div className="h-12 flex flex-col items-center justify-center bg-panel rounded border border-line">
                      <span className="text-sm font-bold text-ink">{g.markets?.homeSpread?.point ? (g.markets.homeSpread.point > 0 ? `+${g.markets.homeSpread.point}` : g.markets.homeSpread.point) : "-"}</span>
                      <span className="text-xs font-bold text-primary">{g.markets?.homeSpread?.price ? formatAm(g.markets.homeSpread.price) : ""}</span>
                    </div>
                  </div>

                  {/* TOTAL Column */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-12 flex flex-col items-center justify-center bg-panel rounded border border-line">
                      <span className="text-sm font-bold text-ink">{g.markets?.over?.point ? `O ${g.markets.over.point}` : "-"}</span>
                      <span className="text-xs font-bold text-primary">{g.markets?.over?.price ? formatAm(g.markets.over.price) : ""}</span>
                    </div>
                    <div className="h-12 flex flex-col items-center justify-center bg-panel rounded border border-line">
                      <span className="text-sm font-bold text-ink">{g.markets?.under?.point ? `U ${g.markets.under.point}` : "-"}</span>
                      <span className="text-xs font-bold text-primary">{g.markets?.under?.price ? formatAm(g.markets.under.price) : ""}</span>
                    </div>
                  </div>

                  {/* WINNER Column */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-12 flex items-center justify-center bg-panel rounded border border-line">
                      <span className="text-sm font-bold text-primary">{g.markets?.awayML ? formatAm(g.markets.awayML) : "-"}</span>
                    </div>
                    <div className="h-12 flex items-center justify-center bg-panel rounded border border-line">
                      <span className="text-sm font-bold text-primary">{g.markets?.homeML ? formatAm(g.markets.homeML) : "-"}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer row */}
              <div className="flex items-center justify-between mt-3 text-sm text-muted">
                <span>{startTime}</span>
                <button className="flex items-center text-primary font-medium hover:underline">
                  More wagers <ChevronRight className="size-4 ml-1" />
                </button>
              </div>

            </div>
          );
        })}
        {games.length === 0 && (
          <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
            No active games to display.
          </div>
        )}
      </div>
    </div>
  );
}