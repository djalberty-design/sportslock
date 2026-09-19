import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useDeskDecision } from "@/lib/market/use-board";
import { LayoutGrid, ChevronRight, BarChart2, CloudSun, AlertTriangle, Zap } from "lucide-react";
import { resolveTeamLogo } from "@/lib/market/logos";
import { SportFilter, applySportFilter } from "@/components/app/sport-filter";
import { useDeskStore, selectIsAdmin } from "@/lib/desk-store";
import { fetchRealPropsFn, getOddsQuotaFn } from "@/lib/market/server";
import { bookAmerican, impliedFromAmerican } from "@/lib/market/book-price";
import { ticketHitPct } from "@/lib/market/hit-pct";
import { formatLivePeriod } from "@/lib/market/live-period";

export const Route = createFileRoute("/games")({ component: TheMatrix });

function TheMatrix() {
  const { snapshot, query, scan } = useDeskDecision();
  const isAdmin = useDeskStore(selectIsAdmin);
  const [quota, setQuota] = useState<number | null>(null);
  const [fetchingEvent, setFetchingEvent] = useState<string | null>(null);

  const SPORT_KEY: Record<string, string> = {
    NFL: "americanfootball_nfl", NCAAF: "americanfootball_ncaaf",
    MLB: "baseball_mlb", NBA: "basketball_nba",
    NHL: "icehockey_nhl", NCAAB: "basketball_ncaab",
  };

  useEffect(() => {
    if (isAdmin) getOddsQuotaFn().then(setQuota).catch(() => {});
  }, [isAdmin]);

  const handleFetchProps = async (eventId: string, sport: string) => {
    const sportKey = SPORT_KEY[sport];
    if (!sportKey) return;
    const rawId = eventId.replace(/^oddsapi-[A-Z]+-/, "");
    setFetchingEvent(eventId);
    try {
      await fetchRealPropsFn({ data: { sportKey, eventId: rawId } });
      const q = await getOddsQuotaFn();
      if (q != null) setQuota(q);
    } catch (e) { console.error(e); }
    setFetchingEvent(null);
  };

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
    g.inPlay = q.inPlay;
    g.homeScore = q.homeScore ?? g.homeScore ?? 0;
    g.awayScore = q.awayScore ?? g.awayScore ?? 0;
    g.period = q.period ?? g.period;
    g.clock = q.clock ?? g.clock;
    g.statusText = q.statusText ?? g.statusText;
    const isHome = q.selection === q.home || q.selection === q.homeAbbr || (g.home && q.selection?.includes(g.home)) || (g.homeAbbr && q.selection?.includes(g.homeAbbr));
    if (q.marketType === "ml") {
      if (isHome) g.markets.homeML = q.price;
      else g.markets.awayML = q.price;
    } else if (q.marketType === "spread") {
      if (isHome) g.markets.homeSpread = { point: q.point, price: q.price };
      else g.markets.awaySpread = { point: q.point, price: q.price };
    } else if (q.marketType === "total") {
      if (q.side === "over") g.markets.over = { point: q.point, price: q.price };
      else if (q.side === "under") g.markets.under = { point: q.point, price: q.price };
    }
    gamesMap.set(q.eventId, g);
  });

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

  function lineHit(g: any, market: string, side: string, price: any): number | null {
    const row = scan?.rows?.find((r: any) =>
      r.eventId === g.eventId &&
      r.marketType === market &&
      (r.side === side || (side === "home" && (r.selection === g.home || r.selection === g.homeAbbr)) || (side === "away" && (r.selection === g.away || r.selection === g.awayAbbr)) || (side === "over" && /over/i.test(r.selection || "")) || (side === "under" && /under/i.test(r.selection || "")))
    );
    return ticketHitPct({ chance: row?.chance, fairProb: row?.fairProb, price });
  }

  function LineBox({ label, sub, hit }: { label: string; sub?: string; hit: number | null }) {
    const empty = !label || label === "-";
    return (
      <div className="min-h-14 flex flex-col items-center justify-center bg-obsidian rounded border border-line px-1 py-1.5">
        <span className="text-sm font-bold text-ink leading-none">{empty ? "-" : label}</span>
        {sub ? <span className="text-[10px] font-bold text-muted mt-0.5">{sub}</span> : null}
        <div className="mt-1 w-full h-1 rounded-full bg-line/40 overflow-hidden">
          <div className={`h-full rounded-full ${empty || hit == null ? "bg-line/70" : "bg-primary"}`} style={{ width: empty || hit == null ? "0%" : `${hit}%` }} />
        </div>
        <span className="text-[9px] font-mono text-muted mt-0.5">{empty ? "" : hit != null ? `${hit}%` : ""}</span>
      </div>
    );
  }

  function matchupLean(g: any): { label: string; pct: number | null } {
    const away = lineHit(g, "ml", "away", g.markets?.awayML);
    const home = lineHit(g, "ml", "home", g.markets?.homeML);
    if (home != null && away != null) {
      return home >= away ? { label: g.home, pct: home } : { label: g.away, pct: away };
    }
    if (home != null) return { label: g.home, pct: home };
    if (away != null) return { label: g.away, pct: away };
    return { label: "", pct: null };
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-6 border-b border-line pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
            <LayoutGrid className="size-6 text-primary" /> Matchups
          </h1>
          {isAdmin && quota != null && (
            <span className="text-xs font-mono bg-panel border border-line rounded-md px-2 py-1 text-muted">
              API: {quota} / 500
            </span>
          )}
        </div>
        {snapshot?.sourceNote && (
          <p className="text-xs text-muted">{snapshot.sourceNote}</p>
        )}
      </div>

      <div className="mb-4">
        <SportFilter sports={liveSports} />
      </div>

      {snapshot?.hours?.note && snapshot.hours.note.includes("CRASH") && (
        <div className="bg-red-500/20 text-red-400 p-4 rounded-md mb-6 whitespace-pre-wrap font-mono text-xs">
          <AlertTriangle className="size-4 inline mr-2" />
          {snapshot.hours.note}
        </div>
      )}

      {query.isPending && !snapshot && (
        <div className="text-center p-12 text-muted">Loading board...</div>
      )}

      {query.isError && (
        <div className="bg-red-500/10 text-red-400 p-6 rounded-xl mb-6 border border-red-500/20">
          <AlertTriangle className="size-5 inline mr-2" />
          Failed to load board data. {query.error?.message}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {games.map(g => {
          const startTime = g.start ? new Date(g.start).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Upcoming";
          const livePeriod = formatLivePeriod({ sport: g.sport, period: g.period, clock: g.clock, statusText: g.statusText });
          const lean = matchupLean(g);
          const awayMark = resolveTeamLogo(g.sport, { logo: g.awayLogo, abbr: g.awayAbbr, name: g.away });
          const homeMark = resolveTeamLogo(g.sport, { logo: g.homeLogo, abbr: g.homeAbbr, name: g.home });
          return (
            <div key={g.eventId} className="flex flex-col bg-panel border border-line rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
              <div className="bg-obsidian border-b border-line p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {g.inPlay ? (
                     <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                       <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
                       <span className="text-[10px] font-bold uppercase tracking-widest">LIVE{livePeriod ? ` · ${livePeriod}` : ""}</span>
                     </div>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-muted shrink-0">{startTime}</span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 bg-primary/5 px-2 py-0.5 rounded">{g.sport}</span>
                  {g.weather && <span className="text-xs text-muted flex items-center gap-1"><CloudSun className="size-3" /> {g.weather.replace(/[^\x20-\x7E]/g, "").trim()}</span>}
                </div>
                <div className="flex-1 max-w-sm w-full">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    <span className="flex items-center gap-1"><BarChart2 className="size-3 text-primary" /> AI Matchup Projection</span>
                    <span className="text-primary">{lean.pct != null ? `${lean.label} ${lean.pct}%` : "Looked"}</span>
                  </div>
                  <p className="text-[10px] text-muted mb-1 leading-tight">Chance this moneyline hits. Not a lock.</p>
                  <div className="h-1.5 w-full bg-line/40 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${lean.pct != null ? "bg-primary" : "bg-line/70"}`} style={{ width: `${lean.pct ?? 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="p-4 flex flex-col md:flex-row">
                <div className="w-full md:w-[40%] flex flex-col justify-between py-1 pr-4 mb-4 md:mb-0 border-b md:border-b-0 md:border-r border-line">
                  <div className="flex items-center gap-3 h-12">
                    {awayMark ? (
                      <img src={awayMark} className="size-8 object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
                    ) : null}
                    <div className={`size-8 rounded-full bg-line flex items-center justify-center text-xs font-bold text-muted ${awayMark ? "hidden" : ""}`}>{(g.awayAbbr || g.away || "?").substring(0, 3)}</div>
                    <span className="text-base font-bold text-ink truncate">{g.away}</span>
                    {g.inPlay && <span className="ml-auto font-mono font-bold text-lg">{g.awayScore}</span>}
                  </div>
                  <div className="flex items-center gap-3 h-12 mt-2">
                    {homeMark ? (
                      <img src={homeMark} className="size-8 object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
                    ) : null}
                    <div className={`size-8 rounded-full bg-line flex items-center justify-center text-xs font-bold text-muted ${homeMark ? "hidden" : ""}`}>{(g.homeAbbr || g.home || "?").substring(0, 3)}</div>
                    <span className="text-base font-bold text-ink truncate">{g.home}</span>
                    {g.inPlay && <span className="ml-auto font-mono font-bold text-lg">{g.homeScore}</span>}
                  </div>
                </div>
                <div className="w-full md:w-[60%] flex gap-2 md:pl-4">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1">Spread</div>
                    <LineBox label={g.markets?.awaySpread?.point != null ? `${g.markets.awaySpread.point > 0 ? "+" : ""}${g.markets.awaySpread.point}` : "-"} sub={g.markets?.awaySpread?.price ? formatAm(g.markets.awaySpread.price) : undefined} hit={lineHit(g, "spread", "away", g.markets?.awaySpread?.price)} />
                    <LineBox label={g.markets?.homeSpread?.point != null ? `${g.markets.homeSpread.point > 0 ? "+" : ""}${g.markets.homeSpread.point}` : "-"} sub={g.markets?.homeSpread?.price ? formatAm(g.markets.homeSpread.price) : undefined} hit={lineHit(g, "spread", "home", g.markets?.homeSpread?.price)} />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1">Total</div>
                    <LineBox label={g.markets?.over?.point != null ? `O ${g.markets.over.point}` : "-"} sub={g.markets?.over?.price ? formatAm(g.markets.over.price) : undefined} hit={lineHit(g, "total", "over", g.markets?.over?.price)} />
                    <LineBox label={g.markets?.under?.point != null ? `U ${g.markets.under.point}` : "-"} sub={g.markets?.under?.price ? formatAm(g.markets.under.price) : undefined} hit={lineHit(g, "total", "under", g.markets?.under.price)} />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1">Winner</div>
                    <LineBox label={g.markets?.awayML ? formatAm(g.markets.awayML) : "-"} hit={lineHit(g, "ml", "away", g.markets?.awayML)} />
                    <LineBox label={g.markets?.homeML ? formatAm(g.markets.homeML) : "-"} hit={lineHit(g, "ml", "home", g.markets?.homeML)} />
                  </div>
                </div>
              </div>
              <div className="bg-obsidian border-t border-line px-4 py-2 flex items-center justify-between">
                 <span className="text-[10px] text-primary/70 font-mono tracking-widest uppercase">SPORTSLOCK SGP BUILDER</span>
                 <div className="flex items-center gap-3">
                   {isAdmin && (
                     <button onClick={(e) => { e.stopPropagation(); handleFetchProps(g.eventId, g.sport); }} disabled={fetchingEvent === g.eventId} className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 disabled:opacity-50">
                       <Zap className="size-3" />
                       {fetchingEvent === g.eventId ? "Pulling..." : "Fetch Props"}
                     </button>
                   )}
                   <Link to="/game/$eventId" params={{ eventId: g.eventId }} className="flex items-center text-primary text-xs font-bold hover:underline">Open Game Ticket <ChevronRight className="size-3 ml-1" /></Link>
                 </div>
              </div>
            </div>
          );
        })}
        {!query.isPending && games.length === 0 && (
          <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
            <p className="text-lg font-semibold mb-2">No games on the board right now</p>
            <p className="text-sm">{snapshot?.sourceNote || "Check back when games are scheduled."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
