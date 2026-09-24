// @ts-nocheck
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useDeskStore, selectTicketPulse } from "@/lib/desk-store";
import { formatBetUsd, formatChancePct, profitOnStake } from "@/lib/copy";
import { formatAmerican } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { ScreenshotIngest } from "./screenshot-ingest";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { postMortem } from "@/lib/market/post-mortem";
import { downloadLedger, paperToLedger } from "@/lib/ledger";
import { ledgerBrier, pendingLayerHaircuts } from "@/lib/market/ledger-law";
import { DESK_VERSION } from "@/lib/market/rules";
import { BankrollTracker } from "./bankroll-tracker";
import { useDeskDecision } from "@/lib/market/use-board";
import { ClvBadge } from "./competitive-widgets";
import { getHardRockUrl } from "@/lib/market/hard-rock-links";
import { TicketLegAvatar } from "./ticket-leg-avatar";
import { teamsMatch } from "@/lib/market/live-scores";
import { formatMarketName, cleanDescription } from "@/lib/market/logos";
import { parseAmericanInput } from "@/lib/market/book-price";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Zap,
  Edit3,
  Save,
  X,
} from "lucide-react";

export function DeskPage() {
  const { snapshot } = useDeskDecision();
  const paperTickets = useDeskStore((s) => s.paperTickets);
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const weekAnchor = useDeskStore((s) => s.weekAnchorBankroll);
  const selfExcluded = useDeskStore((s) => s.selfExcluded);
  const grade = useDeskStore((s) => s.gradeTicket);
  const reopen = useDeskStore((s) => s.reopenTicket);
  const dismiss = useDeskStore((s) => s.dismissTicket);
  const resetPaper = useDeskStore((s) => s.resetPaper);
  const setSelfExcluded = useDeskStore((s) => s.setSelfExcluded);

  const [tab, setTab] = useState<"all" | "open" | "settled">("all");
  const [liveUpdatesMap, setLiveUpdatesMap] = useState<Record<string, { homeScore: number; awayScore: number; statusText?: string }>>({});

  const pulse = selectTicketPulse({ paperTickets });
  const open = paperTickets.filter((t) => t.status === "open");
  const settled = paperTickets.filter((t) => t.status === "win" || t.status === "loss" || t.status === "void");
  const weekPnl = liveBankroll - weekAnchor;
  const entries = paperTickets.map(paperToLedger);
  const brier = ledgerBrier(entries);
  const haircuts = pendingLayerHaircuts(entries);

  // Automated ticket settlement on mount and every 30 seconds
  useEffect(() => {
    if (!open.length) return;
    let cancelled = false;

    const runAutoSettle = async () => {
      try {
        const { settlePaperTicketsFn } = await import("@/lib/market/server");
        const res = await settlePaperTicketsFn({ data: { tickets: open } });
        if (cancelled || !res?.ok) return;

        // Capture live in-play updates
        if (res.liveUpdates?.length) {
          const map: Record<string, any> = {};
          for (const lu of res.liveUpdates) {
            map[lu.id] = lu;
          }
          setLiveUpdatesMap((prev) => ({ ...prev, ...map }));
        }

        // Process settled outcomes
        if (res.settled?.length) {
          for (const item of res.settled) {
            grade(item.id, item.result, item.closePrice, {
              finalScore: item.finalScore,
              legs: item.settledLegs,
            });
          }
        }
      } catch (e) {
        console.error("Auto settle error in DeskPage:", e);
      }
    };

    runAutoSettle();
    const interval = setInterval(runAutoSettle, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open.length, grade]);

  const displayedTickets =
    tab === "open" ? open : tab === "settled" ? settled : paperTickets.filter((t) => t.status !== "dismissed");

  return (
    <div className="space-y-6 pt-4 sm:pt-0">
      <header className="max-w-2xl">
        <p className="text-sm text-emerald-500 font-semibold flex items-center gap-1.5">
          <Zap className="size-4" /> 100% AUTOMATIC BET TRACKING
        </p>
        <h1 className="font-display mt-2 text-3xl text-ink">My Action</h1>
        <p className="mt-2 text-sm text-ink/80">
          Locked-in tickets track in real time and automatically settle when games finish. No manual grading required.
        </p>
      </header>

      {/* Top Bankroll & Performance Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Open Action"
          value={open.length ? formatBetUsd(pulse.atRisk) : "$0"}
          note={open.length ? `${open.length} waiting on games` : "No active tickets"}
          gold={open.length > 0}
        />
        <Stat
          label="Weekly P&L"
          value={formatBetUsd(weekPnl)}
          note="Live bankroll vs weekly start"
          up={weekPnl > 0}
          down={weekPnl < 0}
        />
        <Stat
          label="Hit / Miss Record"
          value={`${pulse.wonCount} won · ${pulse.lostCount} lost`}
          note={pulse.net ? `Net ${formatBetUsd(pulse.net)}` : "Settles automatically"}
          up={pulse.net > 0}
          down={pulse.net < 0}
        />
      </div>

      {/* Hard Rock Bet Style Tickets Section */}
      <section className="space-y-4">
        {/* Tab Filters */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                tab === "all" ? "bg-primary text-black" : "text-muted hover:text-ink hover:bg-line/40"
              )}
            >
              All ({open.length + settled.length})
            </button>
            <button
              onClick={() => setTab("open")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                tab === "open" ? "bg-primary text-black" : "text-muted hover:text-ink hover:bg-line/40"
              )}
            >
              Waiting
              {open.length > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px]",
                  tab === "open" ? "bg-black/20 text-black" : "bg-amber-500/20 text-amber-300"
                )}>
                  {open.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("settled")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                tab === "settled" ? "bg-primary text-black" : "text-muted hover:text-ink hover:bg-line/40"
              )}
            >
              Settled
              {settled.length > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px]",
                  tab === "settled" ? "bg-black/20 text-black" : "bg-line text-muted"
                )}>
                  {settled.length}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-muted hidden sm:inline">
            Auto-checks ESPN final scores
          </span>
        </div>

        {/* Ticket List */}
        {displayedTickets.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {displayedTickets.map((t) => {
              // Match live quote from board snapshot if available
              // ONLY match if the ticket is actively OPEN, RECENT (today), and a single game
              const isTicketOpen = t.status === "open";
              const isRecent = t.createdAt ? (Date.now() - new Date(t.createdAt).getTime() < 36 * 3600 * 1000) : true;
              const isSingle = !t.description.toLowerCase().includes("parlay") && (!t.legs || t.legs.length <= 1);

              let matchQuote = null;
              if (isTicketOpen && isRecent && isSingle) {
                matchQuote = snapshot?.quotes?.find((q) => {
                  if (t.gameIds?.includes(q.eventId)) return true;
                  if (!t.home || !t.away || !q.home || !q.away) return false;
                  return (
                    (teamsMatch(q.home, t.home) && teamsMatch(q.away, t.away)) ||
                    (teamsMatch(q.home, t.away) && teamsMatch(q.away, t.home))
                  );
                });
              }

              const lu = liveUpdatesMap[t.id];
              const isLive = isTicketOpen && (Boolean(lu) || Boolean(matchQuote?.inPlay));
              const isFinal = Boolean(matchQuote?.statusText?.toLowerCase().includes("final") || (matchQuote as any)?.complete);
              const liveScore = lu
                ? `${lu.awayScore} - ${lu.homeScore}`
                : isLive && matchQuote && matchQuote.homeScore != null && matchQuote.awayScore != null
                ? `${matchQuote.awayScore} - ${matchQuote.homeScore}`
                : null;
              const liveStatus = lu?.statusText || matchQuote?.statusText || (isLive ? "In Progress" : null);

              return (
                <HardRockTicketCard
                  key={t.id}
                  ticket={t}
                  isLive={isLive}
                  isFinal={isFinal}
                  liveScore={liveScore}
                  liveStatus={liveStatus}
                  onGrade={grade}
                  onReopen={reopen}
                  onDismiss={dismiss}
                />
              );
            })}
          </div>
        ) : (
          <div className="paper-card p-6 text-center space-y-3">
            <Clock className="size-8 text-muted mx-auto" />
            <p className="text-ink font-semibold">
              {tab === "open" ? "No active tickets waiting." : tab === "settled" ? "No settled tickets yet." : "No tickets locked in."}
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Lock in bets from The Lab or the Matchups board to automatically track them here.
            </p>
          </div>
        )}
      </section>

      {/* Upload Custom Parlay Screenshot option */}
      <details className="paper-card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-500 hover:text-emerald-400">
          + Ingest Custom Hard Rock / DraftKings Slip
        </summary>
        <div className="mt-3 rounded-lg border border-panel-border bg-obsidian p-4">
          <ScreenshotIngest kind="ticket" heading="Upload Slip Screenshot" embedded />
          <p className="mt-2 text-xs text-muted">
            Upload a screenshot of any custom ticket from Hard Rock Bet to automatically transcribe and track it.
          </p>
        </div>
      </details>

      {/* Footer Info & Bankroll Management */}
      <BankrollTracker />

      <section className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => downloadLedger(paperTickets.map(paperToLedger))}
        >
          Download Action Ledger (JSON)
        </Button>
        <Button variant="outline" onClick={resetPaper}>
          Reset Action Log
        </Button>
        <Button variant="danger" onClick={() => setSelfExcluded(!selfExcluded)}>
          {selfExcluded ? "Turn advice back on" : "Pause all advice"}
        </Button>
      </section>
    </div>
  );
}

function HardRockTicketCard({
  ticket,
  isLive,
  isFinal,
  liveScore,
  liveStatus,
  onGrade,
  onReopen,
  onDismiss,
}: {
  ticket: PaperTicket;
  isLive?: boolean;
  isFinal?: boolean;
  liveScore?: string | null;
  liveStatus?: string | null;
  onGrade: (id: string, result: "win" | "loss" | "void", closePrice?: number) => void;
  onReopen?: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [expandedLegs, setExpandedLegs] = useState(true);
  const updateTicket = useDeskStore((s) => s.updateTicket);
  const [isEditing, setIsEditing] = useState(false);

  const price = ticket.livePrice ?? ticket.price ?? -110;
  const pay = profitOnStake(ticket.stake, price);
  const isWon = ticket.status === "win";
  const isLost = ticket.status === "loss";
  const isVoid = ticket.status === "void";
  const isOpen = ticket.status === "open";

  const [editOdds, setEditOdds] = useState(String(price > 0 ? `+${price}` : price));
  const [editWager, setEditWager] = useState(String(ticket.stake));

  useEffect(() => {
    setEditOdds(String(price > 0 ? `+${price}` : price));
    setEditWager(String(ticket.stake));
  }, [price, ticket.stake]);

  const handleSaveEdit = () => {
    const parsedOdds = parseAmericanInput(editOdds) ?? (parseInt(editOdds, 10) || price);
    const parsedStake = parseFloat(editWager) || ticket.stake;
    updateTicket(ticket.id, {
      price: parsedOdds,
      livePrice: parsedOdds,
      postedPrice: parsedOdds,
      stake: parsedStake,
    });
    setIsEditing(false);
  };

  const rawDesc = ticket.description || "";
  const isParlay = ticket.kind === "parlay" || (ticket.legs && ticket.legs.length > 1) || rawDesc.toLowerCase().includes("parlay");

  // Synthesize legs for legacy parlays where ticket.legs array wasn't attached
  let legs = ticket.legs || [];
  if (legs.length === 0 && rawDesc.toLowerCase().includes("parlay")) {
    const parts = rawDesc.includes(":") ? rawDesc.split(/:\s*/)[1] : rawDesc;
    if (parts) {
      legs = parts.split(/\s*\+\s*/).map((s) => ({
        selection: s.trim(),
        status: ticket.status === "win" ? "win" : ticket.status === "loss" ? "loss" : "open",
      }));
    }
  }

  const isSgp = isParlay && legs.length > 1 && legs.some((l, i) => legs.slice(i + 1).some((l2) => l.eventId && l.eventId === l2.eventId));

  const hardRockLink = getHardRockUrl(ticket.sport || legs[0]?.sport);

  return (
    <div
      className={cn(
        "rounded-xl border bg-panel transition-all overflow-hidden shadow-sm",
        isLive && "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30",
        isWon && "border-emerald-500/40 bg-gradient-to-b from-panel to-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
        isLost && "border-line/60 bg-panel/70 opacity-90",
        isVoid && "border-line/60 bg-panel/70",
        isOpen && !isLive && "border-line hover:border-line/80"
      )}
    >
      {/* Top Slip Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-obsidian/70 border-b border-line/60">
        <div className="flex items-center gap-2">
          {isSgp ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
              <Zap className="size-2.5 fill-amber-300" /> SAME GAME PARLAY
            </span>
          ) : isParlay ? (
            <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-300">
              {legs.length > 0 ? `${legs.length}-LEG PARLAY` : "PARLAY"}
            </span>
          ) : (
            <span className="inline-flex items-center rounded bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
              STRAIGHT BET
            </span>
          )}
          <span className="text-[11px] font-mono text-muted">
            #SL-{ticket.id.slice(-5).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-0.5 text-xs font-bold text-red-400 animate-pulse">
              <span className="size-1.5 rounded-full bg-red-400" />
              LIVE
            </span>
          ) : isOpen ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              <Clock className="size-3" />
              WAITING
            </span>
          ) : isWon ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="size-3" />
              WON
            </span>
          ) : isLost ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/60 dark:border-red-500/30 dark:text-red-300 px-2.5 py-0.5 text-xs font-bold">
              <XCircle className="size-3 text-red-600 dark:text-red-400" />
              LOST
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              PUSH
            </span>
          )}
        </div>
      </div>

      {/* Slip Body */}
      <div className="p-4 space-y-3">
        {/* Legs or Single Selection */}
        {isParlay && legs.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider">{cleanDescription(ticket.description)}</span>
              <button
                onClick={() => setExpandedLegs(!expandedLegs)}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-ink cursor-pointer"
              >
                {expandedLegs ? "Collapse" : "Expand"}
                {expandedLegs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
            </div>

            {expandedLegs && (
              <div className="divide-y divide-line/40 rounded-lg border border-line/50 bg-obsidian/40 overflow-hidden">
                {legs.map((leg, idx) => {
                  const isPropLeg = Boolean(
                    leg.isProp ||
                    leg.player ||
                    leg.marketType === "prop" ||
                    String(leg.marketType || "").startsWith("player_") ||
                    /anytime\s*touchdown/i.test(leg.selection || "") ||
                    /\b(passing|rushing|receiving|receptions|strikeouts|hits|points|rebounds|assists)\b/i.test(leg.selection || "")
                  );
                  const homeName = leg.home || ticket.home;
                  const awayName = leg.away || ticket.away;
                  const hasRealMatchup = awayName && homeName && awayName !== "Away" && homeName !== "Home";
                  const legSport = leg.sport || ticket.sport;
                  const matchupSub = isPropLeg
                    ? (legSport ? `Player Prop · ${legSport}` : "Player Prop")
                    : hasRealMatchup
                      ? `${awayName} @ ${homeName}`
                      : (legSport || "Game Line");

                  const formattedMarket = formatMarketName(leg.marketType, leg.selection);

                  return (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-[10px] bg-primary/20 text-primary font-bold px-1 rounded shrink-0">
                          {idx + 1}
                        </span>
                        <TicketLegAvatar
                          leg={{
                            ...leg,
                            sport: leg.sport || ticket.sport,
                            home: leg.home || ticket.home,
                            away: leg.away || ticket.away,
                            homeLogo: leg.homeLogo || ticket.homeLogo,
                            awayLogo: leg.awayLogo || ticket.awayLogo,
                          }}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-bold text-ink truncate">{cleanDescription(leg.selection)}</div>
                          <div className="text-[11px] text-muted truncate">
                            {formattedMarket} · {matchupSub}
                            {leg.finalScore ? ` (${leg.finalScore})` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-ink">
                          {leg.price ? (leg.price > 0 ? `+${leg.price}` : leg.price) : "—"}
                        </span>
                        {leg.status === "win" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                        ) : leg.status === "loss" ? (
                          <XCircle className="size-3.5 text-red-400" />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <TicketLegAvatar
                  leg={{
                    selection: ticket.selection || ticket.description,
                    sport: ticket.sport,
                    home: ticket.home,
                    away: ticket.away,
                    isProp: ticket.isProp,
                    player: ticket.player,
                    marketType: ticket.marketType,
                    side: ticket.side,
                  }}
                  size="md"
                />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-ink leading-snug">
                    {cleanDescription(ticket.description)}
                  </h3>
                  {ticket.home && ticket.away && !isParlay && (
                    <p className="text-xs text-muted">
                      {ticket.away} at {ticket.home}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-primary shrink-0">
                {price > 0 ? `+${price}` : price}
              </span>
            </div>

            {/* Score / Live info banner - NEVER show Live on settled tickets */}
            {isOpen && isLive && (
              <div className="flex items-center gap-2 text-xs font-mono pt-1">
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-red-400 animate-ping" />
                  Live{liveScore ? `: ${liveScore}` : ""} {liveStatus ? `(${liveStatus})` : "(In Progress)"}
                </span>
              </div>
            )}
            {!isLive && (ticket.finalScore || (isFinal && liveScore)) && (
              <div className="flex items-center gap-2 text-xs font-mono pt-1 text-muted">
                Final Score: <span className="text-ink font-bold">{ticket.finalScore || liveScore}</span>
              </div>
            )}

            {ticket.chance != null && (
              <p className="text-xs text-muted pt-0.5">
                Model estimate: <span className="font-semibold text-emerald-400">{formatChancePct(ticket.chance)}</span> to hit
              </p>
            )}
          </div>
        )}

        {/* Hard Rock Financial Summary Strip / Editor */}
        {isEditing ? (
          <div className="pt-2 border-t border-line/60">
            <div className="p-3 rounded-lg bg-obsidian border border-primary/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-primary">
                <span className="flex items-center gap-1.5"><Edit3 className="size-3.5" /> Adjust Odds &amp; Wager</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-muted hover:text-ink cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1">Total Odds (American)</label>
                  <input
                    type="text"
                    value={editOdds}
                    onChange={(e) => setEditOdds(e.target.value)}
                    placeholder="+605"
                    className="w-full bg-panel border border-line rounded px-2.5 py-1.5 text-xs font-mono font-bold text-ink focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1">Total Wager ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editWager}
                    onChange={(e) => setEditWager(e.target.value)}
                    placeholder="3"
                    className="w-full bg-panel border border-line rounded px-2.5 py-1.5 text-xs font-mono font-bold text-ink focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted text-[11px]">
                  New Payout: <strong className="font-mono text-ink">${(profitOnStake(parseFloat(editWager) || 0, parseAmericanInput(editOdds) ?? (parseInt(editOdds, 10) || price)).total).toFixed(2)}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold text-muted hover:text-ink hover:bg-line/40 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-1 rounded text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="size-3" /> Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-line/60">
            <div
              onClick={() => {
                setEditOdds(String(price > 0 ? `+${price}` : price));
                setEditWager(String(ticket.stake));
                setIsEditing(true);
              }}
              className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-obsidian/60 text-xs hover:bg-obsidian/90 transition-colors cursor-pointer group"
              title="Click to edit odds or wager"
            >
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-bold flex items-center gap-1">
                  Total Wager <Edit3 className="size-2.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </div>
                <div className="font-mono font-bold text-ink text-sm mt-0.5">
                  {formatBetUsd(ticket.stake)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-bold flex items-center gap-1">
                  Total Odds <Edit3 className="size-2.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </div>
                <div className="font-mono font-bold text-ink text-sm mt-0.5">
                  {formatAmerican(price)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted font-bold">
                  {isWon ? "Paid" : "Potential Payout"}
                </div>
                <div className={cn("font-mono font-bold text-sm mt-0.5", isWon ? "text-emerald-400 text-base" : "text-ink")}>
                  {formatBetUsd(pay.total)}
                </div>
              </div>
            </div>

            {/* Won celebration note */}
            {isWon && (
              <div className="mt-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1 flex items-center justify-between">
                <span>✓ Bet Settled & Won</span>
                <span>+{formatBetUsd(pay.profit)} Profit</span>
              </div>
            )}
            {isLost && (
              <div className="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/25 rounded px-2.5 py-1.5 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <XCircle className="size-3.5 text-red-600 dark:text-red-400" />
                  Bet Settled &amp; Lost
                </span>
                <span className="text-red-600 dark:text-red-400 font-mono font-bold">-{formatBetUsd(ticket.stake)}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions: Hard Rock Bet deep link & optional subtle override */}
        <div className="flex items-center justify-between pt-1">
          <a
            href={hardRockLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Hard Rock Bet <ExternalLink className="size-3" />
          </a>

          <div className="relative">
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="p-1 rounded text-muted hover:text-ink hover:bg-line/40 transition-colors cursor-pointer"
              title="Ticket options"
            >
              <MoreVertical className="size-3.5" />
            </button>

            {showOverride && (
              <div className="absolute right-0 bottom-full mb-1 w-44 rounded-lg border border-line bg-panel p-1.5 shadow-xl z-20 text-xs space-y-1">
                <div className="text-[10px] text-muted font-bold px-1.5 py-0.5 uppercase tracking-wider">
                  Manual Override
                </div>
                <button
                  onClick={() => {
                    setEditOdds(String(price > 0 ? `+${price}` : price));
                    setEditWager(String(ticket.stake));
                    setIsEditing(true);
                    setShowOverride(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-primary/20 text-primary font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="size-3" /> Edit Odds &amp; Wager
                </button>
                {isOpen ? (
                  <>
                    <button
                      onClick={() => {
                        onGrade(ticket.id, "win", price);
                        setShowOverride(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-emerald-500/20 text-emerald-400 font-semibold cursor-pointer"
                    >
                      Mark as Hit (Win)
                    </button>
                    <button
                      onClick={() => {
                        onGrade(ticket.id, "loss", price);
                        setShowOverride(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-red-500/20 text-red-400 font-semibold cursor-pointer"
                    >
                      Mark as Miss (Loss)
                    </button>
                    <button
                      onClick={() => {
                        onGrade(ticket.id, "void");
                        setShowOverride(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-line text-muted cursor-pointer"
                    >
                      Mark as Push
                    </button>
                  </>
                ) : (
                  <>
                    {!isWon && (
                      <button
                        onClick={() => {
                          onGrade(ticket.id, "win", price);
                          setShowOverride(false);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-emerald-500/20 text-emerald-400 font-semibold cursor-pointer"
                      >
                        Change to Hit (Win)
                      </button>
                    )}
                    {!isLost && (
                      <button
                        onClick={() => {
                          onGrade(ticket.id, "loss", price);
                          setShowOverride(false);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-red-500/20 text-red-400 font-semibold cursor-pointer"
                      >
                        Change to Miss (Loss)
                      </button>
                    )}
                    {!isVoid && (
                      <button
                        onClick={() => {
                          onGrade(ticket.id, "void");
                          setShowOverride(false);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-line text-muted cursor-pointer"
                      >
                        Change to Push
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (onReopen) onReopen(ticket.id);
                        else onGrade(ticket.id, "open");
                        setShowOverride(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-amber-500/20 text-amber-400 font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      <Clock className="size-3" /> Reopen Ticket (Move to Live)
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    onDismiss(ticket.id);
                    setShowOverride(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-red-500/20 text-red-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="size-3" /> Delete Ticket
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  gold,
  up,
  down,
}: {
  label: string;
  value: string;
  note: string;
  gold?: boolean;
  up?: boolean;
  down?: boolean;
}) {
  return (
    <div className="paper-card p-4">
      <p className="stamp text-muted">{label}</p>
      <p
        className={cn(
          "font-display mt-2 text-2xl tabular-nums",
          gold && "text-emerald-500",
          up && "text-up",
          down && "text-down",
          !gold && !up && !down && "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
