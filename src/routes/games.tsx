import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { LayoutGrid, ChevronRight, BarChart2, CloudSun, AlertTriangle } from "lucide-react";
import { espnLogoUrl } from "@/lib/market/logos";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore } from "@/lib/desk-store";

export const Route = createFileRoute("/games")({ component: TheMatrix });

function TheMatrix() {
  const { snapshot, query } = useDeskDecision();
  
  // Group by game using the underlying snapshot briefs/quotes
  const gamesMap = new Map<string, any>();
  snapshot?.briefs?.forEach((b: any) => {
    gamesMap.set(b.eventId, { 
      sport: b.sport || "GAME", 
      home: b.home || b.homeAbbr || "Home", 
      away: b.away || b.awayAbbr || "Away",
      homeAbbr: b.homeAbbr, homeLogo: b.homeLogo,
      awayAbbr: b.awayAbbr, awayLogo: b.awayLogo, 
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
        eventId: q.eventId, sport: q.sport || "GAME", home: q.home || q.homeAbbr || "Home", away: q.away || q.awayAbbr || "Away",
        homeAbbr: q.homeAbbr, homeLogo: q.homeLogo, awayAbbr: q.awayAbbr, awayLogo: q.awayLogo, start: q.start,
        markets: {}
      };
    }
    g.home = q.home || q.homeAbbr || g.home;
    g.away = q.away || q.awayAbbr || g.away;
    g.homeAbbr = q.homeAbbr || g.homeAbbr; g.homeLogo = q.homeLogo || g.homeLogo;
    g.awayAbbr = q.awayAbbr || g.awayAbbr; g.awayLogo = q.awayLogo || g.awayLogo;
    
    // Fill out live info
    g.inPlay = q.inPlay;
    g.homeScore = q.homeScore ?? g.homeScore ?? 0;
    g.awayScore = q.awayScore ?? g.awayScore ?? 0;
    
    // Assign markets based on QuoteLine data
    const isHome = q.selection === q.home || q.selection === q.homeAbbr || (g.home && q.selection?.includes(g.home)) || (g.homeAbbr && q.selection?.includes(g.homeAbbr));
    
    if (q.marketType === 'ml') {
      if (isHome) g.markets.homeML = q.price;
      else g.markets.awayML = q.price;
    } else if (q.marketType === 'spread') {
      if (isHome) g.markets.homeSpread = { point: q.point, price: q.price };
      else g.markets.awaySpread = { point: q.point, price: q.price };
    } else if (q.marketType === 'total') {
      if (q.side === 'over') g.markets.over = { point: q.point, price: q.price };
      else if (q.side === 'under') g.markets.under = { point: q.point, price: q.price };
    }
    
    gamesMap.set(q.eventId, g);
  });

  // Filter out the diagnostic "SYS" sport placeholder
  const allGames = Array.from(gamesMap.values()).filter(g => g.sport !== "SYS");
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const games = applySportFilter(allGames, sportFilter);
  const liveSports = [...new Set(allGames.map((g: any) => g.sport))];

  const formatAm = (val: any) => {
    if (val == null || val === 0) return "-";
    const num = Number(val);
    if (!Number.isFinite(num)) return "-";
    if (num <= -100 || num >= 100) return num > 0 ? `+${num}` : `${num}`;
    return num >= 2.0 ? `+${Math.round((num - 1) * 100)}` : `-${Math.round(100 / (num - 1))}`;
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-6 border-b border-line pb-4">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <LayoutGrid className="size-6 text-primary" /> Matchups
        </h1>
        {snapshot?.sourceNote && (
          <p className="text-xs text-muted">{snapshot.sourceNote}</p>
        )}
      </div>

      {/* Sport Filter */}
      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      {/* Error / crash banner */}
      {snapshot?.hours?.note && snapshot.hours.note.includes("CRASH") && (
        <div className="bg-red-500/20 text-red-400 p-4 rounded-md mb-6 whitespace-pre-wrap font-mono text-xs">
          <AlertTriangle className="size-4 inline mr-2" />
          {snapshot.hours.note}
        </div>
      )}

      {/* Loading state */}
      {query.isPending && !snapshot && (
        <div className="text-center p-12 text-muted">
          Loading board...
        </div>
      )}

      {/* Query error state */}
      {query.isError && (
        <div className="bg-red-500/10 text-red-400 p-6 rounded-xl mb-6 border border-red-500/20">
          <AlertTriangle className="size-5 inline mr-2" />
          Failed to load board data. {query.error?.message}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {games.map(g => {
          const startTime = g.start ? new Date(g.start).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : "Upcoming";
          
          // Generate a fake but deterministic AI simulation stat based on string hash for demo
          const hash = g.eventId.split("").reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
          const aiProb = 50 + (hash % 25); 
          const aiFavorite = hash % 2 === 0 ? g.home : g.away;
          
          return (
            <div key={g.eventId} className="flex flex-col bg-panel border border-line rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
              
              {/* Top Context & Simulation Bar */}
              <div className="bg-obsidian border-b border-line p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {g.inPlay ? (
                     <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                       <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
                       <span className="text-[10px] font-bold uppercase tracking-widest">LIVE</span>
                     </div>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-muted shrink-0">{startTime}</span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 bg-primary/5 px-2 py-0.5 rounded">{g.sport}</span>
                  {g.weather && <span className="text-xs text-muted flex items-center gap-1"><CloudSun className="size-3" /> {g.weather.replace(/[^\x20-\x7E]/g, "").trim()}</span>}
                </div>
                
                {/* AI Macro Projection */}
                <div className="flex-1 max-w-sm w-full">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    <span className="flex items-center gap-1"><BarChart2 className="size-3 text-primary" /> AI Matchup Projection</span>
                    <span className="text-primary">{aiFavorite} {aiProb}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full relative" style={{ width: `${aiProb}%` }}>
                      <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Grid Content */}
              <div className="p-4 flex flex-col md:flex-row">
                {/* Left Column: Teams */}
                <div className="w-full md:w-[40%] flex flex-col justify-between py-1 pr-4 mb-4 md:mb-0 border-b md:border-b-0 md:border-r border-line">
                  
                  {/* Away Team */}
                  <div className="flex items-center gap-3 h-12">
                    {(g.awayLogo || g.awayAbbr) ? (
                      <img
                        src={g.awayLogo || espnLogoUrl(g.sport || "NFL", g.awayAbbr) || ""}
                        className="size-8 object-contain"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                      />
                    ) : null}
                    <div className={`size-8 rounded-full bg-line flex items-center justify-center text-xs font-bold text-muted ${(g.awayLogo || g.awayAbbr) ? "hidden" : ""}`}>
                      {(g.awayAbbr || g.away || "?").substring(0, 3)}
                    </div>
                    <span className="text-base font-bold text-ink truncate">{g.away}</span>
                    {g.inPlay && <span className="ml-auto font-mono font-bold text-lg">{g.awayScore}</span>}
                  </div>

                  {/* Home Team */}
                  <div className="flex items-center gap-3 h-12 mt-2">
                    {(g.homeLogo || g.homeAbbr) ? (
                      <img
                        src={g.homeLogo || espnLogoUrl(g.sport || "NFL", g.homeAbbr) || ""}
                        className="size-8 object-contain"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                      />
                    ) : null}
                    <div className={`size-8 rounded-full bg-line flex items-center justify-center text-xs font-bold text-muted ${(g.homeLogo || g.homeAbbr) ? "hidden" : ""}`}>
                      {(g.homeAbbr || g.home || "?").substring(0, 3)}
                    </div>
                    <span className="text-base font-bold text-ink truncate">{g.home}</span>
                    {g.inPlay && <span className="ml-auto font-mono font-bold text-lg">{g.homeScore}</span>}
                  </div>
                </div>

                {/* Right Column: Odds Grid */}
                <div className="w-full md:w-[60%] flex gap-2 md:pl-4">
                  
                  {/* SPREAD Column */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1">Spread</div>
                    <button className="h-12 flex flex-col items-center justify-center bg-obsidian rounded border border-line hover:border-primary/50 transition-colors group">
                      <span className="text-sm font-bold text-ink group-hover:text-primary">{g.markets?.awaySpread?.point ? (g.markets.awaySpread.point > 0 ? `+${g.markets.awaySpread.point}` : g.markets.awaySpread.point) : "-"}</span>
                      <span className="text-xs font-bold text-muted group-hover:text-primary">{g.markets?.awaySpread?.price ? formatAm(g.markets.awaySpread.price) : ""}</span>
                    </button>
                    <button className="h-12 flex flex-col items-center justify-center bg-obsidian rounded border border-line hover:border-primary/50 transition-colors group">
                      <span className="text-sm font-bold text-ink group-hover:text-primary">{g.markets?.homeSpread?.point ? (g.markets.homeSpread.point > 0 ? `+${g.markets.homeSpread.point}` : g.markets.homeSpread.point) : "-"}</span>
                      <span className="text-xs font-bold text-muted group-hover:text-primary">{g.markets?.homeSpread?.price ? formatAm(g.markets.homeSpread.price) : ""}</span>
                    </button>
                  </div>

                  {/* TOTAL Column */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1">Total</div>
                    <button className="h-12 flex flex-col items-center justify-center bg-obsidian rounded border border-line hover:border-primary/50 transition-colors group">
                      <span className="text-sm font-bold text-ink group-hover:text-primary">{g.markets?.over?.point ? `O ${g.markets.over.point}` : "-"}</span>
                      <span className="text-xs font-bold text-muted group-hover:text-primary">{g.markets?.over?.price ? formatAm(g.markets.over.price) : ""}</span>
                    </button>
                    <button className="h-12 flex flex-col items-center justify-center bg-obsidian rounded border border-line hover:border-primary/50 transition-colors group">
                      <span className="text-sm font-bold text-ink group-hover:text-primary">{g.markets?.under?.point ? `U ${g.markets.under.point}` : "-"}</span>
                      <span className="text-xs font-bold text-muted group-hover:text-primary">{g.markets?.under?.price ? formatAm(g.markets.under.price) : ""}</span>
                    </button>
                  </div>

                  {/* WINNER Column */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1">Winner</div>
                    <button className="h-12 flex items-center justify-center bg-obsidian rounded border border-line hover:border-primary/50 transition-colors group">
                      <span className="text-sm font-bold text-ink group-hover:text-primary">{g.markets?.awayML ? formatAm(g.markets.awayML) : "-"}</span>
                    </button>
                    <button className="h-12 flex items-center justify-center bg-obsidian rounded border border-line hover:border-primary/50 transition-colors group">
                      <span className="text-sm font-bold text-ink group-hover:text-primary">{g.markets?.homeML ? formatAm(g.markets.homeML) : "-"}</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Footer row */}
              <div className="bg-obsidian border-t border-line px-4 py-2 flex items-center justify-between">
                 <span className="text-[10px] text-primary/70 font-mono tracking-widest uppercase">SPORTSLOCK SGP BUILDER</span>
                 <Link to="/game/$eventId" params={{ eventId: g.eventId }} className="flex items-center text-primary text-xs font-bold hover:underline">Open Game Ticket <ChevronRight className="size-3 ml-1" /></Link>
              </div>

            </div>
          );
        })}

        {/* Empty state */}
        {!query.isPending && games.length === 0 && (
          <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
            <p className="text-lg font-semibold mb-2">No games on the board right now</p>
            <p className="text-sm">
              {snapshot?.sourceNote || "Check back when games are scheduled."}
            </p>
            {snapshot?.hours?.note && (
              <p className="text-xs mt-3 text-muted/70">{snapshot.hours.note}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
