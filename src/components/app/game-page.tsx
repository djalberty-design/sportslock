import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { fetchRealPropsFn, lockPredictionFn } from "@/lib/market/server";
import { useDeskStore, selectIsAdmin } from "@/lib/desk-store";
import { ChevronLeft, ChevronRight, BarChart2, ShieldCheck, X, CloudSun, TrendingUp, Zap, Check } from "lucide-react";
import { useDeskDecision } from "@/lib/market/use-board";
import { espnLogoUrl } from "@/lib/market/logos";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useParlaySlip, isLegSelected, type ParlayLeg } from "@/lib/parlay-slip";

export function GamePage({ eventId }: { eventId: string }) {
  const { snapshot, picks } = useDeskDecision();
  const [activeTab, setActiveTab] = useState("popular");
  const { legs: sgpSlip, addLeg, removeLeg } = useParlaySlip();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wager, setWager] = useState("50");
  const [finalOdds, setFinalOdds] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const isAdmin = useDeskStore(selectIsAdmin);
  const [isFetchingProps, setIsFetchingProps] = useState(false);

  const SPORT_KEY: Record<string, string> = {
    NFL: "americanfootball_nfl", NCAAF: "americanfootball_ncaaf",
    NBA: "basketball_nba", NCAAB: "basketball_ncaab",
    MLB: "baseball_mlb", NHL: "icehockey_nhl",
  };

  const handleFetchRealProps = async () => {
    if (!firstQuoteRef?.sport) return;
    const sportKey = SPORT_KEY[firstQuoteRef.sport] || firstQuoteRef.sport;
    const rawId = eventId.replace(/^oddsapi-[A-Z]+-/, "");
    setIsFetchingProps(true);
    try {
      await fetchRealPropsFn({ data: { sportKey, eventId: rawId } });
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
    setIsFetchingProps(false);
  };

  const gameQuotes = useMemo(() => snapshot?.quotes?.filter((q: any) => q.eventId === eventId) || [], [snapshot, eventId]);
  const firstQuoteRef = gameQuotes[0];

  const gameProps = useMemo(() => {
    const allProps = picks?.allProps || picks?.props || [];
    const fromPicks = allProps.filter((p: any) => p.eventId === eventId || p.row?.eventId === eventId);
    const fromQuotes = snapshot?.quotes?.filter((q: any) => q.eventId === eventId && (q.isProp || !["ml", "spread", "total"].includes(q.marketType))) || [];
    const combined = [...fromQuotes, ...fromPicks];
    const unique: any[] = [];
    const seen = new Set();
    for (const p of combined) {
      const key = p.selection + (p.marketType || "");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }
    return unique;
  }, [picks, snapshot, eventId]);

  const gameBrief = useMemo(() => snapshot?.briefs?.find((b: any) => b.eventId === eventId), [snapshot, eventId]);
  const gamePred = useMemo(() => snapshot?.predictions?.find((p: any) => p.eventId === eventId), [snapshot, eventId]);

  if (gameQuotes.length === 0 && gameProps.length === 0) {
    return <div className="p-8 text-center text-muted">Game not found or loading...</div>;
  }

  const firstQuote = gameQuotes[0] || gameProps[0]?.row || gameProps[0];
  const homeLogo = firstQuote?.homeLogo || espnLogoUrl(firstQuote?.sport || "NFL", firstQuoteRef?.homeAbbr);
  const awayLogo = firstQuote?.awayLogo || espnLogoUrl(firstQuote?.sport || "NFL", firstQuoteRef?.awayAbbr);
  const isLive = firstQuote?.inPlay;

  // Odds math — American odds are the canonical format from the API.
  // Safety: detect legacy decimal odds (1.01–19.99) and convert them.
  const toAmerican = (d: number) => d >= 2.0 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1));
  const isDecimal = (v: number) => v > 1 && v < 20;

  const getProb = (q: any): number => {
    if (q.fairProb && Number.isFinite(q.fairProb)) return q.fairProb;
    if (q.row?.fairProb && Number.isFinite(q.row.fairProb)) return q.row.fairProb;
    const p = q.hardRockPrice || q.consensusPrice || q.price || q.row?.hardRockPrice || -110;
    const am = isDecimal(p) ? toAmerican(p) : p;
    return am < 0 ? -am / (-am + 100) : 100 / (am + 100);
  };

  const toggleLeg = (quote: any) => {
    const sel = quote.selection;
    const mkt = quote.marketType || quote.row?.marketType || "unknown";
    // If already selected, remove it
    if (isLegSelected(sgpSlip, sel, mkt)) {
      removeLeg(sel, mkt);
    } else {
      // Add to global slip with mutual exclusivity on same event+market
      const rawP = quote.hardRockPrice || quote.consensusPrice || quote.price || quote.row?.hardRockPrice || -110;
      const am = isDecimal(rawP) ? toAmerican(rawP) : rawP;
      addLeg({
        eventId: quote.eventId || eventId,
        selection: sel,
        marketType: mkt,
        side: quote.side,
        point: quote.point ?? quote.row?.point,
        price: am,
        fairProb: getProb(quote),
        sport: quote.sport || firstQuote?.sport,
        home: quote.home || firstQuote?.home,
        away: quote.away || firstQuote?.away,
        player: quote.player || quote.row?.player,
      });
    }
    setSaved(false);
  };

  const isSelected = (quote: any) => isLegSelected(
    sgpSlip,
    quote.selection,
    quote.marketType || quote.row?.marketType || "unknown",
  );

  const getAmOdds = (q: any) => {
    let rawP = q.hardRockPrice || q.consensusPrice || q.price || q.row?.hardRockPrice;
    if (!rawP || rawP === 0) {
      // No odds available — show dash
      return "—";
    }
    // Safety: convert stale decimal odds to American
    if (isDecimal(rawP)) rawP = toAmerican(rawP);
    return rawP > 0 ? `+${rawP}` : `${rawP}`;
  };

  const getProb = (q: any) => {
    if (q.fairProb) return q.fairProb;
    if (q.chance) return q.chance;
    let rawP = q.hardRockPrice || q.consensusPrice || q.price || q.row?.hardRockPrice || -110;
    // Safety: convert stale decimal odds to American
    if (isDecimal(rawP)) rawP = toAmerican(rawP);
    if (rawP < 0) return (-rawP) / (-rawP + 100);
    return 100 / (rawP + 100);
  };

  // Shared helper to normalize any price to American odds
  const normalizePrice = (p: number): number => {
    if (!p || p === 0) return -110;
    if (isDecimal(p)) return toAmerican(p);
    return p;
  };

  const priceToProb = (p: number): number => {
    const am = normalizePrice(p);
    return am < 0 ? (-am) / (-am + 100) : 100 / (am + 100);
  };

  // Combined SGP math — legs now have .price (American) and .fairProb directly
  const combinedProb = sgpSlip.length > 0 ? sgpSlip.reduce((acc, leg) => acc * (leg.fairProb || 0.5), 1) : 0;
  const hitProbPct = Math.round(combinedProb * 100);

  const vegasImplied = sgpSlip.length > 0 ? sgpSlip.reduce((acc, leg) => {
    const am = leg.price || -110;
    return acc * (am < 0 ? (-am) / (-am + 100) : 100 / (am + 100));
  }, 1) : 0;
  const vegasPct = Math.round(vegasImplied * 100);
  const edgeVal = (hitProbPct - vegasPct).toFixed(1);

  // For single bets, use the leg's actual price directly (no probability round-trip)
  // For multi-leg parlays, compute combined American odds from combined probability
  let americanOdds = "";
  if (sgpSlip.length === 1) {
    const am = sgpSlip[0].price || -110;
    americanOdds = am > 0 ? `+${am}` : `${am}`;
  } else if (sgpSlip.length > 1) {
    const decPayout = 1 / (vegasImplied || 0.5);
    americanOdds = decPayout >= 2.0
      ? `+${Math.round((decPayout - 1) * 100)}`
      : `-${Math.round(100 / (decPayout - 1))}`;
  }

  const decPayout = vegasImplied > 0 ? 1 / vegasImplied : 2;

  // Smart wager: quarter Kelly
  const kellyFraction = combinedProb > 0 && vegasImplied > 0
    ? Math.max(0, ((combinedProb * decPayout - 1) / (decPayout - 1)) * 0.25)
    : 0;
  const smartWager = Math.max(5, Math.round(kellyFraction * 1000)); // Assume $1000 bankroll

  // Payout calc
  const wagerNum = parseFloat(wager) || 0;
  const finalOddsNum = parseInt(finalOdds || americanOdds) || 0;
  const payout = finalOddsNum > 0
    ? wagerNum * (finalOddsNum / 100)
    : finalOddsNum < 0
      ? wagerNum * (100 / Math.abs(finalOddsNum))
      : 0;

  const handleLockIn = async () => {
    setIsSaving(true);
    try {
      const legs = sgpSlip.map(q => ({
        eventId: q.eventId || eventId,
        selection: q.selection,
        marketType: q.marketType || "unknown",
        point: q.point,
        price: parseInt(finalOdds || americanOdds) || q.price || -110,
        fairProb: q.fairProb || 0.5,
      }));
      await lockPredictionFn({ data: { legs } });
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
    setIsSaving(false);
  };

  const renderGrid = (type: string) => {
    let items: any[] = [];
    const lines = gameQuotes.filter((q: any) => q.marketType === "spread" || q.marketType === "total" || q.marketType === "ml");

    if (type === "popular") items = [...lines.slice(0, 4), ...gameProps.slice(0, 6)];
    else if (type === "props") items = gameProps;
    else if (type === "lines") items = lines;

    return (
      <div className="flex flex-col gap-3 pb-24">
        {isAdmin && type === "props" && (
          <div className="bg-paper p-3 rounded-xl border border-line flex items-center justify-between shadow-sm">
             <span className="text-xs text-muted font-mono uppercase tracking-wider flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-green-500" /> Admin Sniper
             </span>
             <button
               onClick={handleFetchRealProps}
               disabled={isFetchingProps}
               className="px-4 py-1.5 bg-green-500/10 text-green-500 text-xs font-bold uppercase tracking-wider rounded border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
             >
               {isFetchingProps ? "Pulling..." : "Fetch Real Props (1 Req)"}
             </button>
          </div>
        )}
        {items.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-line rounded-xl">
            {type === "props" ? (isAdmin ? "No props yet. Click the button above." : "Player props pending release.") : "No markets available."}
          </div>
        )}
        {items.map((q, i) => {
          const amOdds = getAmOdds(q);
          const prob = getProb(q);
          const probPct = Math.round(prob * 100);
          const label = q.player || q.row?.player ? q.selection.replace(q.player || q.row?.player, "").trim() : q.selection;
          const playerName = q.player || q.row?.player;
          const pointText = q.point ? (q.point > 0 ? `+${q.point}` : q.point) : "";
          const headshotUrl = (q.row as any)?.headshot;
          const rowKey = `${q.selection}-${q.marketType || ""}`;
          const isExp = expandedRow === rowKey;

          // Edge vs vegas
          let vegasP = q.hardRockPrice || q.consensusPrice || q.price || q.row?.hardRockPrice || -110;
          let vProb = vegasP < 0 ? (-vegasP / (-vegasP + 100)) : (100 / (vegasP + 100));
          const edgePct = ((prob - vProb) * 100).toFixed(1);

          return (
            <div key={i}>
              <div
                className={cn(
                  "bg-panel border rounded-lg p-3 flex items-center justify-between transition-colors cursor-pointer",
                  isSelected(q) ? "border-primary/50 bg-primary/5" : "border-line hover:border-primary/30"
                )}
                onClick={() => setExpandedRow(isExp ? null : rowKey)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {headshotUrl && (
                    <div className="shrink-0 size-10">
                      <img src={headshotUrl} className="size-full rounded-full object-cover ring-1 ring-line bg-obsidian" alt={playerName || ""} />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    {playerName ? (
                      <>
                        <span className="font-bold text-ink text-sm truncate">{playerName}</span>
                        <span className="text-muted text-xs truncate">{label} {pointText}</span>
                      </>
                    ) : (
                      <span className="font-bold text-ink text-sm truncate">{label} {pointText}</span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-muted font-bold mt-0.5">{q.marketType || q.row?.marketType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLeg(q); }}
                    className={cn("flex flex-col items-center justify-center min-w-[70px] h-10 rounded-md border transition-colors",
                      isSelected(q) ? "bg-primary border-primary text-primary-foreground" : "bg-obsidian border-line text-primary hover:border-primary/50"
                    )}
                  >
                    <span className="font-mono text-sm font-bold">{amOdds}</span>
                  </button>
                </div>
              </div>
              {/* Always-visible AI prediction bar */}
              <div className="mt-2 mx-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-line/40 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", probPct >= 55 ? "bg-emerald-500" : probPct >= 45 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${probPct}%` }} />
                  </div>
                  <span className={cn("text-xs font-mono font-bold whitespace-nowrap", probPct >= 55 ? "text-emerald-400" : probPct >= 45 ? "text-amber-400" : "text-red-400")}>
                    {probPct}%
                  </span>
                  {parseFloat(edgePct) !== 0 && (
                    <span className={cn("text-[9px] font-mono px-1 rounded", parseFloat(edgePct) > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                      {parseFloat(edgePct) > 0 ? "+" : ""}{edgePct}%
                    </span>
                  )}
                </div>
              </div>

              {/* Simulation detail — expanded on click */}
              <AnimatePresence>
                {isExp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-obsidian border border-t-0 border-line rounded-b-lg px-4 py-3 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xs text-muted mb-1">AI Model</div>
                        <div className="text-lg font-mono font-bold text-primary">{probPct}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">Vegas Implied</div>
                        <div className="text-lg font-mono font-bold text-ink">{Math.round(vProb * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1">Edge</div>
                        <div className={cn("text-lg font-mono font-bold", parseFloat(edgePct) > 0 ? "text-emerald-400" : "text-red-400")}>
                          {parseFloat(edgePct) > 0 ? "+" : ""}{edgePct}%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto animate-in fade-in duration-500 min-h-dvh relative bg-background">

      {/* Header */}
      <div className="sticky top-0 sm:top-7 z-40 bg-background/95 backdrop-blur border-b border-line px-4 pt-4 pb-0">
        <Link to="/games" className="inline-flex items-center text-sm font-bold text-primary mb-4 hover:underline">
          <ChevronLeft className="size-4 mr-1" /> Back to Matchups
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <div className="flex items-center -space-x-3">
                {awayLogo ? <img src={awayLogo} className="size-12 rounded-full ring-4 ring-background bg-panel object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="size-12 rounded-full bg-line ring-4 ring-background" />}
                {homeLogo ? <img src={homeLogo} className="size-12 rounded-full ring-4 ring-background bg-panel object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="size-12 rounded-full bg-line ring-4 ring-background" />}
             </div>
             <div className="flex flex-col">
                <span className="text-xl font-display font-bold text-ink">{firstQuoteRef?.awayAbbr || "AWAY"} @ {firstQuoteRef?.homeAbbr || "HOME"}</span>
                <span className="text-xs text-muted flex items-center gap-1 mt-0.5">
                  {gameBrief?.weather && <CloudSun className="size-3" />}
                  {gameBrief?.weather ? gameBrief.weather.replace(/[^\x20-\x7E]/g, "").trim() : "Dome"} &bull; {firstQuote?.start ? new Date(firstQuote.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Upcoming"}
                </span>
             </div>
          </div>
          {isLive && (
             <div className="flex flex-col items-end">
               <span className="font-mono text-2xl font-bold text-ink">{firstQuote.awayScore} - {firstQuote.homeScore}</span>
               <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">LIVE</span>
             </div>
          )}
        </div>

        {/* AI Prediction summary for this game */}
        {gamePred && (
          <div className="flex items-center gap-4 mb-3 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            <TrendingUp className="size-4 text-primary shrink-0" />
            <div className="flex-1 text-xs">
              <span className="font-bold text-ink">AI Prediction:</span>{" "}
              <span className="text-muted">
                {gamePred.pick || `${firstQuoteRef?.homeAbbr} ${gamePred.homeWinPct ? `${Math.round(gamePred.homeWinPct * 100)}%` : ""}`}
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-line/0">
           {["popular", "lines", "props"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn("pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap", activeTab === tab ? "text-primary" : "text-muted hover:text-ink")}
              >
                 {tab === "lines" ? "Game Lines" : tab === "props" ? "Player Props" : tab}
                 {activeTab === tab && <motion.div layoutId="sgptab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
           ))}
        </div>
      </div>

      <div className="p-4">
        {renderGrid(activeTab)}
      </div>

      {/* Dynamic SGP Ticker (Fixed Bottom) */}
      <AnimatePresence>
        {sgpSlip.length > 0 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 z-50 md:left-64 p-4 pointer-events-none"
          >
             <div className="max-w-4xl mx-auto bg-obsidian border border-primary/30 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden pointer-events-auto">
                {/* Leg breakdown */}
                <div className="px-4 pt-4 space-y-2 max-h-40 overflow-y-auto">
                  {sgpSlip.map((leg, i) => {
                    const legLabel = leg.player || leg.row?.player
                      ? `${leg.player || leg.row?.player}: ${leg.selection.replace(leg.player || leg.row?.player, "").trim()}`
                      : leg.selection;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="size-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">{i + 1}</span>
                          <span className="text-ink truncate">{legLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-primary">{getAmOdds(leg)}</span>
                          <span className="text-muted font-mono">{Math.round(getProb(leg) * 100)}%</span>
                          <button onClick={() => toggleLeg(leg)} className="text-muted hover:text-red-400 p-0.5"><X className="size-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Combined stats */}
                <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">{sgpSlip.length === 1 ? "Straight Bet" : `${sgpSlip.length}-Leg SGP`} <span className="text-primary ml-2">{americanOdds}</span></span>
                    <span className="text-xs font-bold text-primary font-mono">{hitProbPct}% PROB</span>
                  </div>
                  <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full relative transition-all duration-300" style={{ width: `${hitProbPct}%` }}>
                      <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted">
                    <span>Vegas Implied: {vegasPct}%</span>
                    <span className={cn("px-1 rounded", parseFloat(edgeVal) > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10")}>
                      Delta: {parseFloat(edgeVal) > 0 ? `+${edgeVal}` : edgeVal}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => { setIsModalOpen(true); setFinalOdds(americanOdds); }}
                      className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      Lock It In
                    </button>
                  </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lock It In Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-line flex items-center justify-between">
                <h3 className="font-display font-bold text-lg flex items-center gap-2"><ShieldCheck className="text-primary size-5" /> Ledger Confirmation</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-obsidian rounded-full transition-colors"><X className="size-5 text-muted" /></button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-muted">Edit to precisely match the Hard Rock odds before saving.</p>

                {/* Legs summary */}
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {sgpSlip.map((leg, i) => (
                    <div key={i} className="flex items-center justify-between bg-obsidian rounded-lg px-3 py-2 text-xs">
                      <span className="text-ink truncate flex-1 mr-2">{leg.player || leg.row?.player || leg.selection}</span>
                      <span className="font-mono text-primary shrink-0">{getAmOdds(leg)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Final Odds (American)</label>
                  <input
                    type="text"
                    value={finalOdds}
                    onChange={(e) => setFinalOdds(e.target.value)}
                    className="w-full bg-obsidian border border-line rounded-lg px-4 py-3 text-ink font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Wager Amount ($)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={wager}
                      onChange={(e) => setWager(e.target.value)}
                      className="w-full bg-obsidian border border-line rounded-lg px-4 py-3 text-ink font-mono focus:outline-none focus:border-primary text-lg"
                    />
                    <button
                      onClick={() => setWager(String(smartWager))}
                      className="shrink-0 bg-primary/10 text-primary border border-primary/20 px-4 rounded-lg font-bold text-xs flex flex-col items-center justify-center hover:bg-primary/20 transition-colors group"
                    >
                      <span className="group-hover:scale-105 transition-transform"><Zap className="size-3 inline mr-0.5" />SMART</span>
                      <span className="group-hover:scale-105 transition-transform">${smartWager}</span>
                    </button>
                  </div>
                </div>

                {/* Payout preview */}
                <div className="bg-obsidian rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-muted">Potential Profit</span>
                  <span className="font-mono font-bold text-primary text-lg">${payout.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 bg-obsidian border-t border-line">
                {saved ? (
                  <div className="w-full bg-emerald-500/20 text-emerald-400 font-bold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2">
                    <Check className="size-5" /> Saved to Ledger
                  </div>
                ) : (
                  <button
                    onClick={handleLockIn}
                    disabled={isSaving}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save to SportsLock Ledger"} <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}