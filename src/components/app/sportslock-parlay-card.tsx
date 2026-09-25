import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Flame, BarChart2, X, CheckCircle2, ChevronDown, Clock, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { classifyMix } from "@/lib/market/feed-mix";
import { matchSnapshotEvent, resolveLegTeam, resolvePlayerHeadshotSync, fetchPlayerHeadshot } from "@/lib/market/logos";
import { FeedLockModal } from "./feed-lock-modal";
import { cn, formatEasternTime } from "@/lib/utils";
import { QuantFactorWaterfall } from "./quant-factor-waterfall";
import { computeQuantFactorWaterfall } from "@/lib/market/waterfall";
import { useDeskStore } from "@/lib/desk-store";
import { calculateDynamicWager } from "@/lib/kelly";

function getLegTimeInfo(leg: any, quote?: any, allQuotes?: any[]) {
  const startStr = leg?.start || quote?.start;
  const dateObj = startStr ? new Date(startStr) : null;
  const timeFormatted = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }) + " ET"
    : null;
  const dateFormatted = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })
    : null;

  let doubleheaderText: string | null = null;
  const home = quote?.home || leg?.home;
  const away = quote?.away || leg?.away;
  if (home && away && allQuotes && Array.isArray(allQuotes) && dateObj) {
    const sameDayGames = allQuotes.filter((q: any) => {
      if (!q.start || !q.home || !q.away) return false;
      const qDate = new Date(q.start);
      return (
        qDate.toDateString() === dateObj.toDateString() &&
        ((q.home === home && q.away === away) || (q.home === away && q.away === home))
      );
    });
    const uniqueEvents = Array.from(new Set(sameDayGames.map((g: any) => g.eventId)))
      .map(id => sameDayGames.find((g: any) => g.eventId === id))
      .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (uniqueEvents.length > 1) {
      const targetEventId = quote?.eventId || leg?.eventId;
      const gameIdx = uniqueEvents.findIndex((g: any) => g?.eventId === targetEventId);
      if (gameIdx >= 0) {
        doubleheaderText = `Game ${gameIdx + 1} of ${uniqueEvents.length}`;
      } else {
        doubleheaderText = "Doubleheader";
      }
    }
  }

  return { timeFormatted, dateFormatted, doubleheaderText };
}

function TeamMark({ src, name }: { src: string | null; name: string }) {
  const letter = (name || "?").replace(/^(the)\s+/i, "").charAt(0).toUpperCase() || "?";
  return (
    <span className="relative size-8 shrink-0">
      <span className="absolute inset-0 rounded-full bg-line ring-2 ring-panel flex items-center justify-center text-[11px] font-bold text-muted">{letter}</span>
      {src ? (
        <img
          src={src}
          alt={name}
          className="relative size-8 rounded-full ring-2 ring-panel bg-white object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

function LegMark({
  leg,
  teams,
}: {
  leg: any;
  teams: { awayLogo: string | null; awayName?: string; homeLogo: string | null; homeName?: string };
}) {
  const isProp = Boolean(leg?.isProp || leg?.player || leg?.marketType === "prop" || String(leg?.marketType || "").startsWith("player_"));
  const playerName = leg?.player;
  const [headshot, setHeadshot] = useState<string | undefined>(
    leg?.headshot || (playerName ? resolvePlayerHeadshotSync(playerName) || undefined : undefined)
  );
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    if (leg?.headshot) {
      setHeadshot(leg.headshot);
      setImgErr(false);
      return;
    }
    if (isProp && playerName) {
      const sync = resolvePlayerHeadshotSync(playerName);
      if (sync) {
        setHeadshot(sync);
        setImgErr(false);
      } else {
        fetchPlayerHeadshot(playerName, leg?.sport).then((url) => {
          if (url) {
            setHeadshot(url);
            setImgErr(false);
          }
        }).catch(() => {});
      }
    }
  }, [leg?.headshot, isProp, playerName, leg?.sport]);

  if (isProp && playerName) {
    if (headshot && !imgErr) {
      return (
        <span className="relative size-8 shrink-0">
          <img
            src={headshot}
            alt={playerName}
            onError={() => setImgErr(true)}
            className="size-8 rounded-full ring-2 ring-panel bg-obsidian object-cover"
          />
        </span>
      );
    }
    const initials = playerName
      .split(/\s+/)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      <span className="size-8 rounded-full bg-purple-500/10 border border-purple-500/30 ring-2 ring-panel flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-purple-300 font-mono">{initials || "P"}</span>
      </span>
    );
  }

  return (
    <div className="flex items-center -space-x-2 shrink-0">
      <TeamMark src={teams.awayLogo} name={teams.awayName || "Away"} />
      <TeamMark src={teams.homeLogo} name={teams.homeName || "Home"} />
    </div>
  );
}

function displaySelection(leg: any, teams: { homeName?: string; awayName?: string; side?: string }) {
  const sel = String(leg?.selection || "").trim();
  if (!sel) return teams.homeName || "Pick";
  if (/^(over|under)\s/i.test(sel) || /\b[ouO]\s?\d/.test(sel)) return sel;
  if (/^home(\s*[-+]?\d+(\.\d+)?)?$/i.test(sel) || (sel.length <= 4 && teams.side === "home")) {
    const pt = leg?.point != null ? (leg.point > 0 ? ` +${leg.point}` : ` ${leg.point}`) : (sel.match(/[-+]?\d+(\.\d+)?/)?.[0] ? ` ${sel.match(/[-+]?\d+(\.\d+)?/)?.[0]}` : "");
    return `${teams.homeName || "Home"}${pt}`;
  }
  if (/^away(\s*[-+]?\d+(\.\d+)?)?$/i.test(sel) || (sel.length <= 4 && teams.side === "away")) {
    const pt = leg?.point != null ? (leg.point > 0 ? ` +${leg.point}` : ` ${leg.point}`) : (sel.match(/[-+]?\d+(\.\d+)?/)?.[0] ? ` ${sel.match(/[-+]?\d+(\.\d+)?/)?.[0]}` : "");
    return `${teams.awayName || "Away"}${pt}`;
  }
  return sel;
}

export function SportsLockParlayCard({ parlay, snapshot }: { parlay: any; snapshot?: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);

  const totalBankroll = useDeskStore((s) => s.totalBankroll);
  const baseUnitSize = useDeskStore((s) => s.baseUnitSize);
  const riskProfileMode = useDeskStore((s) => s.riskProfileMode);

  const pick = parlay;
  const parlayCand = pick?.parlay || pick;
  const legs = parlayCand?.legs || [];
  const isGold = pick?.feedLane === "gold";

  const fairDec = parlayCand?.combinedFair ? (1 / parlayCand.combinedFair).toFixed(2) : "0.00";
  const payoutDec = (pick?.decimalPayout || parlayCand?.decimalPayout)
    ? (pick?.decimalPayout || parlayCand?.decimalPayout).toFixed(2)
    : fairDec;

  const decPayout = parseFloat(payoutDec);
  const americanOdds = decPayout >= 2.0
    ? `+${Math.round((decPayout - 1) * 100)}`
    : `-${Math.round(100 / (decPayout - 1))}`;

  const numericOdds = typeof americanOdds === "string" ? parseInt(americanOdds, 10) || -110 : americanOdds;
  const dynWager = calculateDynamicWager({
    totalBankroll,
    baseUnitSize,
    riskMode: riskProfileMode,
    fairProb: parlayCand?.combinedFair || 0.5,
    bookOdds: numericOdds,
  });

  const [customWager, setCustomWager] = useState<string | null>(null);
  const wager = customWager !== null ? customWager : String(dynWager.wagerDollars || 10);
  const numWager = parseFloat(wager || "0");
  const rawInsight = pick?.why || parlayCand?.reason || "AI Simulation favors this combination based on heavily correlated game scripts and player usage rates.";
  const aiInsight = rawInsight.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

  const firstLeg = legs[0];
  const firstHit = matchSnapshotEvent(snapshot, firstLeg);
  const firstQuote = firstHit.quote;
  const firstBrief = firstHit.brief;
  const firstTeams = resolveLegTeam(firstLeg, firstQuote);
  const homeLogo = firstTeams.homeLogo;
  const awayLogo = firstTeams.awayLogo;
  const isLive = firstQuote?.inPlay;
  const mix = classifyMix(pick);

  const combinedEv = parlayCand?.combinedEv || 0;
  const combinedProb = Math.round((1 / (parseFloat(fairDec) || 2)) * 100);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-xl p-4 shadow-sm flex flex-col cursor-pointer transition-colors",
          isGold
            ? "border border-amber-600/40 dark:border-amber-400/35 bg-gradient-to-b from-amber-500/[0.15] dark:from-amber-500/[0.12] via-panel to-panel hover:border-amber-600/60 dark:hover:border-amber-300/50"
            : "border border-line bg-panel hover:border-primary/50",
        )}
        onClick={() => setIsSheetOpen(true)}
      >
        {isGold ? <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-600/70 dark:via-amber-300/70 to-transparent" /> : null}
        <div className="flex items-center justify-between mb-4 border-b border-line/50 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2">
              <TeamMark src={awayLogo} name={firstTeams.awayName || "Away"} />
              <TeamMark src={homeLogo} name={firstTeams.homeName || "Home"} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-ink leading-tight">
                {firstTeams.awayName || firstLeg?.away || "Away"} at {firstTeams.homeName || firstLeg?.home || "Home"}
              </span>
              <span className="text-[10px] text-muted flex items-center gap-2">
                {firstQuote?.start ? formatEasternTime(firstQuote.start) : "TODAY"}
                {firstBrief?.weather && <span>&bull; {firstBrief.weather.replace(/[^\x20-\x7E]/g, "").trim()}</span>}
              </span>
            </div>
          </div>
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest">LIVE</span>
            </div>
          ) : (
            <div className={cn("text-lg font-bold font-mono", isGold ? "text-amber-800 dark:text-amber-300 font-extrabold" : "text-primary")}>{americanOdds}</div>
          )}
        </div>

        <div className="mb-4 bg-obsidian rounded-lg p-2.5 border border-line/30 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
            <span className="flex items-center gap-1"><BarChart2 className={cn("size-3", isGold ? "text-amber-600 dark:text-amber-300" : "text-primary")} /> % to Hit</span>
            <span className={isGold ? "text-amber-800 dark:text-amber-300 font-bold" : "text-primary"}>{combinedProb}% HIT PROB</span>
          </div>
          <div className="h-1.5 w-full bg-line/50 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full relative", isGold ? "bg-amber-500 dark:bg-amber-400" : "bg-primary")} style={{ width: `${combinedProb}%` }}>
              <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="text-ink font-display font-bold text-base mb-3 flex items-center gap-2 flex-wrap">
          {legs.length}-Leg Parlay
          {isGold ? (
            <span className="text-amber-900 dark:text-amber-300 text-[10px] font-mono uppercase tracking-wider bg-amber-400/20 dark:bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/40 font-bold">Gold ticket</span>
          ) : (
            <span className="text-muted text-[10px] font-mono uppercase tracking-wider bg-obsidian px-1.5 py-0.5 rounded border border-line">Catalog</span>
          )}
          <span className="text-muted text-[10px] font-mono uppercase tracking-wider bg-obsidian px-1.5 py-0.5 rounded border border-line">{mix.label}</span>
          <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded border font-bold", isGold ? "text-amber-900 dark:text-amber-300 bg-amber-400/15 dark:bg-amber-400/10 border-amber-400/30" : "text-primary bg-primary/10 border-primary/20")}>
            +{Math.round(combinedEv * 100)}% EDGE
          </span>
        </div>

        <div className="mb-4 flex-1 space-y-4">
          {legs.map((leg: any, i: number) => {
            const hit = matchSnapshotEvent(snapshot, leg);
            const legQuote = hit.quote;
            const teams = resolveLegTeam(leg, legQuote);
            const isSharp = (legQuote?.handlePct || 0) - (legQuote?.ticketPct || 0) >= 15;
            return (
              <div key={i} className="flex items-start gap-3 relative">
                {isSharp && (
                  <div className="absolute -left-1.5 top-0 z-10">
                    <Flame className="size-4 text-orange-500 fill-orange-500/20" />
                  </div>
                )}
                <div className="shrink-0 mt-0.5">
                  <LegMark leg={leg} teams={teams} />
                </div>
                <div className="flex flex-col w-full min-w-0">
                  <div className="text-sm flex items-start justify-between w-full gap-2">
                    <span className="font-bold text-ink leading-tight">{displaySelection(leg, teams)}</span>
                    <span className="text-muted text-xs uppercase tracking-wider font-bold shrink-0">{leg.marketType} </span>
                  </div>
                  <div className="text-muted text-[11px] mt-0.5 leading-tight">{teams.matchup}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn("mt-2 mb-4 p-3 rounded-lg text-xs italic border-l-2", isGold ? "bg-amber-500/10 dark:bg-amber-500/5 border border-amber-600/20 dark:border-amber-400/15 text-amber-950 dark:text-amber-100/90 border-l-amber-600 dark:border-l-amber-400 font-medium" : "bg-primary/5 border border-primary/10 text-primary/90 border-l-primary")}>
          "{aiInsight}"
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(true);
          }}
          className={cn(
            "w-full font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-between group",
            isGold ? "bg-amber-500 hover:bg-amber-400 text-black dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-zinc-950" : "bg-primary hover:bg-primary/90 text-primary-foreground",
          )}
        >
          <span>Lock It In</span>
          <span className="font-mono text-sm group-hover:scale-105 transition-transform">
            ${wager} pays ${(numWager * decPayout).toFixed(2)}
          </span>
        </button>
      </motion.div>

      <AnimatePresence>
        {isSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm" onClick={() => setIsSheetOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-[90dvh] sm:h-auto sm:max-h-[85dvh] max-w-2xl bg-panel sm:border border-line sm:rounded-2xl shadow-2xl flex flex-col rounded-t-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-line flex items-center justify-between bg-obsidian">
                <div className="flex flex-col">
                  <h3 className="font-display font-bold text-xl text-ink">Deep Dive Analysis</h3>
                  <span className="text-xs text-muted font-mono">{legs.length}-Leg Parlay &bull; {americanOdds}</span>
                </div>
                <button onClick={() => setIsSheetOpen(false)} className="p-2 hover:bg-panel rounded-full transition-colors"><X className="size-6 text-muted" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                 <div className="flex flex-col gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                   <div className="flex items-center gap-2 text-primary font-bold">
                     <CheckCircle2 className="size-5" /> AI Consensus: High Value
                   </div>
                   <p className="text-sm text-ink/90 leading-relaxed">{aiInsight}</p>
                 </div>
                 <div className="flex items-center justify-between border-b border-line pb-2 mt-4">
                   <h4 className="font-bold text-sm uppercase tracking-wider text-muted">Leg-by-Leg Metrics</h4>
                   <span className="text-[11px] text-muted font-mono">Tap any leg to expand AI & Vegas breakdown</span>
                 </div>
                 <div className="flex flex-col gap-4">
                    {legs.map((leg: any, i: number) => {
                      const hit = matchSnapshotEvent(snapshot, leg);
                      const teams = resolveLegTeam(leg, hit.quote);
                      const timeInfo = getLegTimeInfo(leg, hit.quote, snapshot?.quotes);
                      const isExp = expandedLeg === i;

                      const legProb = leg.fairProb ?? hit.quote?.fairProb ?? 0.5;
                      const rawPrice = Number(leg.price) || -110;
                      const impliedProb = rawPrice < 0 ? Math.abs(rawPrice) / (Math.abs(rawPrice) + 100) : 100 / (rawPrice + 100);
                      const edgeVal = +((legProb - impliedProb) * 100).toFixed(1);
                      const simFair = hit.quote?.simFair ?? null;

                      return (
                        <div
                          key={i}
                          onClick={() => setExpandedLeg(isExp ? null : i)}
                          className={cn(
                            "bg-obsidian border rounded-xl p-4 flex flex-col gap-3 transition-colors cursor-pointer select-none",
                            isExp ? "border-primary/60 shadow-md ring-1 ring-primary/20" : "border-line hover:border-line/80 hover:bg-obsidian/80"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="shrink-0 mt-0.5">
                                <LegMark leg={leg} teams={teams} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-ink text-base leading-tight">{displaySelection(leg, teams)}</span>
                                  {timeInfo.doubleheaderText && (
                                    <span className="bg-primary/20 text-primary border border-primary/30 font-bold px-2 py-0.5 rounded text-[10px] tracking-wide">
                                      {timeInfo.doubleheaderText}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-muted mt-0.5 flex-wrap">
                                  <span>{leg.marketType} &bull; {teams.matchup}</span>
                                  {timeInfo.timeFormatted && (
                                    <span className="text-[11px] font-mono text-ink/70 flex items-center gap-1 font-normal bg-line/30 px-1.5 py-0.5 rounded">
                                      <Clock className="size-3 text-muted" />
                                      {timeInfo.dateFormatted ? `${timeInfo.dateFormatted} · ` : ""}{timeInfo.timeFormatted}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="p-1 rounded-md text-muted hover:text-ink shrink-0"
                              aria-label={isExp ? "Collapse details" : "Expand details"}
                            >
                              <ChevronDown className={cn("size-5 transition-transform duration-200", isExp && "rotate-180 text-primary")} />
                            </button>
                          </div>

                          {/* % to hit this leg */}
                          {leg.fairProb != null && (
                            <div className="mt-1">
                              <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                                <span className="font-medium">Chance to hit this leg</span>
                                <span className="font-bold text-ink font-mono">{Math.round(leg.fairProb * 100)}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-line/50 overflow-hidden">
                                <div className={`h-full rounded-full ${leg.fairProb >= 0.6 ? 'bg-emerald-500' : leg.fairProb >= 0.45 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.round(leg.fairProb * 100)}%` }} />
                              </div>
                              <p className="text-[9px] text-muted mt-0.5">
                                {leg.fairProb >= 0.65 ? 'Strong favorite — high chance' : leg.fairProb >= 0.55 ? 'Slight edge — better than a coin flip' : leg.fairProb >= 0.45 ? 'Close to a toss-up — could go either way' : leg.fairProb >= 0.3 ? 'Underdog — lower chance, bigger payout' : 'Long shot — risky but high reward'}
                              </p>
                            </div>
                          )}

                          {/* Expandable Deep Dive Metrics Panel */}
                          <AnimatePresence>
                            {isExp && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-line/60 pt-3 mt-1"
                              >
                                <div className="grid grid-cols-3 gap-2 text-center bg-panel/70 rounded-xl p-3 border border-line/40">
                                  <div>
                                    <div className="text-[10px] text-muted mb-0.5 uppercase tracking-wider font-bold">Our AI says</div>
                                    <div className="text-lg font-mono font-bold text-primary">{Math.round(legProb * 100)}%</div>
                                    <div className="text-[9px] text-muted">chance to hit</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted mb-0.5 uppercase tracking-wider font-bold">Vegas says</div>
                                    <div className="text-lg font-mono font-bold text-ink">{Math.round(impliedProb * 100)}%</div>
                                    <div className="text-[9px] text-muted">implied ({rawPrice > 0 ? `+${rawPrice}` : rawPrice})</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted mb-0.5 uppercase tracking-wider font-bold">Your edge</div>
                                    <div className={cn("text-lg font-mono font-bold", edgeVal > 0 ? "text-emerald-400" : "text-amber-400")}>
                                      {edgeVal > 0 ? "+" : ""}{edgeVal}%
                                    </div>
                                    <div className="text-[9px] text-muted">{edgeVal > 0 ? "value bet" : "fair value"}</div>
                                  </div>
                                </div>

                                {/* Context metrics */}
                                <div className="flex items-center justify-between text-[11px] text-muted pt-2.5 px-1 flex-wrap gap-2">
                                  {simFair != null && (
                                    <span className="font-mono">
                                      ⚡ 10k Sim: <strong className="text-ink font-semibold">{Math.round(simFair * 100)}%</strong>
                                    </span>
                                  )}
                                  {hit.brief?.venue && (
                                    <span>🏟️ {hit.brief.venue}</span>
                                  )}
                                  {hit.brief?.weather && (
                                    <span>🌤️ {hit.brief.weather}</span>
                                  )}
                                </div>

                                {/* Quant Factor Waterfall Attribution */}
                                <div className="mt-3 pt-2.5 border-t border-line/50 space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted px-0.5">
                                    <span>Quant Alpha Attribution</span>
                                    <span className="text-[9px] font-mono text-primary font-normal">Orthogonal Factors</span>
                                  </div>
                                  <QuantFactorWaterfall
                                    waterfall={computeQuantFactorWaterfall(
                                      {
                                        ...leg,
                                        price: rawPrice,
                                        hardRockPrice: rawPrice,
                                        fairProb: legProb,
                                        simFair: simFair ?? legProb,
                                        marketType: leg.marketType,
                                        selection: leg.selection,
                                        sport: leg.sport,
                                      },
                                      hit.quote || hit.brief
                                    )}
                                    compact={true}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                 </div>
              </div>
              <div className="p-4 sm:p-6 bg-obsidian border-t border-line">
                <button
                  onClick={() => {
                    setIsSheetOpen(false);
                    setTimeout(() => setIsModalOpen(true), 300);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
                >
                  <ShieldCheck className="size-5" /> Proceed to Lock In
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FeedLockModal
        key={isModalOpen ? "open" : "shut"}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        parlay={parlay}
        snapshot={snapshot}
        americanOdds={americanOdds}
      />
    </>
  );
}
