import * as React from "react";
import { FastLogModal } from "./fast-log-modal";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { useDeskStore } from "@/lib/desk-store";
import { formatAmerican, formatPct, formatKickoff, isTodayEt, cn } from "@/lib/utils";
import { MARKET_LABEL, TAG_LABEL, shortPick, sportLabel } from "@/lib/copy";
import { leanEnglish, researchedFavorite, sortByResearchedChance, uniqueUpcomingGames, rowToPick } from "@/lib/market/research";

import { SportFilter, applySportFilter, SportSeasonNote } from "./sport-filter";
import { WagerMeter, HitReadout, getEdgeTone } from "./wager-meter";
import { espnLogoUrl } from "@/lib/market/logos";
import { isCollegeSport } from "@/lib/market/universe";
import type { EventBrief, PredictQuote, ScanRow } from "@/lib/market/types";
import { LiveStamp } from "./live-stamp";
import { PickCard } from "./pick-card";
import { SkeletonCard } from "./skeleton-card";
import type { DeskPick } from "@/lib/market/picks";

export function BoardPage() {
  const { snapshot, scan, ranking, picks, query } = useDeskDecision();
  const [comboLegs, setComboLegs] = React.useState<string[]>([]);
  const toggleLeg = (eventId: string) => {
    setComboLegs((prev) => prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]);
  };
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const setSportFilter = useDeskStore((s) => s.setSportFilter);
  const hideCollege = useDeskStore((s) => s.hideCollege);
  const splits = snapshot?.publicSplits ?? [];
  const rows = (scan?.rows ?? []).filter((r) => !(hideCollege && isCollegeSport(r.sport)));
  const sports = [...new Set((scan?.rows ?? []).map((r) => r.sport))];
  const navigate = useNavigate();
  const setParlayLegs = useDeskStore((s) => s.setParlayLegs);
  const allGames = uniqueUpcomingGames(rows);

  const handleBuildCombo = () => {
    try {
      const legs = [];

      // Defensively cast dictionaries to arrays
      const rawRows = scan?.rows || [];
      const allRows = Array.isArray(rawRows) ? rawRows : Object.values(rawRows);

      const rawPicks = picks || [];
      const picksArray = Array.isArray(rawPicks) ? rawPicks : Object.values(rawPicks);

      for (const eventId of comboLegs) {
        // Added optional chaining (p?.) to prevent null pointer crashes
        const pick = picksArray.find(p => p?.eventId === eventId || p?.row?.eventId === eventId || p?.id?.includes(eventId));
        
        if (pick && pick.row) {
          legs.push(rowToPick(pick.row));
        } else {
          // Added optional chaining (r?.) to prevent null pointer crashes
          const fallbackRow = allRows.find(r => r?.eventId === eventId && (r?.marketType === "moneyline" || r?.marketType === "spread"));
          if (fallbackRow) {
            legs.push(rowToPick(fallbackRow));
          }
        }
      }

      if (legs.length > 1) {
        setParlayLegs(legs);
        navigate({ to: "/parlay" });
      } else {
        alert("Could not build combo: Found " + legs.length + " valid legs for " + comboLegs.length + " selected games.");
      }
    } catch (err) {
      alert("Combo Error: " + (err instanceof Error ? err.message : String(err)));
    }
  };
  const games = sortByResearchedChance(
    applySportFilter(allGames, sportFilter),
    rows,
    snapshot?.briefs,
    snapshot?.predict,
  );
  const today = games.filter((g) => isTodayEt(g.start) || g.inPlay).sort((a, b) => Number(b.inPlay || false) - Number(a.inPlay || false));
  const later = games.filter((g) => !isTodayEt(g.start) && !g.inPlay).sort((a, b) => Number(b.inPlay || false) - Number(a.inPlay || false));
  const tableRows = applySportFilter(rows, sportFilter);
  const filteredEmpty = !games.length && sportFilter && sportFilter !== "ALL" && allGames.length > 0;
  const feedLooked = !allGames.length && (!sportFilter || sportFilter === "ALL");

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-neon">Odds-API powered board · tap a game to bet that one ticket</p>
        <h1 className="font-display mt-2 text-3xl text-ink">Every game. Who's more likely, and what it pays.</h1>
        <p className="mt-3 text-sm text-ink/80">{snapshot?.hours.note ?? snapshot?.sourceNote}</p>
        <p className="mt-1 font-mono text-xs text-muted">
          as of {snapshot ? new Date(snapshot.asOf).toLocaleString() : "\u2014"} {"\u00b7"} {snapshot?.hours.label}
        </p>
      </header>

      {ranking ? (
        <p className="rounded-md bg-panel px-4 py-3 text-sm text-muted">
          Ranking tickets in the background. You can still tap around.
        </p>
      ) : null}

      <SportFilter sports={sports} />

      {query.isLoading || !snapshot ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
      <GameGrid
        comboLegs={comboLegs}
        onToggleLeg={toggleLeg}
        title="Playing today"
        empty={
          filteredEmpty
            ? `This filter is ${sportLabel(sportFilter)}. No ${sportLabel(sportFilter)} game is tipping on this slate. ${allGames.length} other game${allGames.length === 1 ? "" : "s"} sit on All — clear the filter.`
            : feedLooked
              ? "ESPN feed Looked empty on this pull — not a skip. Photograph a Hard Rock Bet Florida screen."
              : today.length
                ? ""
                : later.length
                  ? `Nothing tipping today${sportFilter && sportFilter !== "ALL" ? ` in ${sportLabel(sportFilter)}` : ""}. Later this week is below.`
                  : sportFilter && sportFilter !== "ALL"
                    ? `This filter is ${sportLabel(sportFilter)}. No game tipping.`
                    : "No game tipping today."
        }
        games={today}
        rows={rows}
          picks={picks?.all}
        briefs={snapshot?.briefs}
        quotes={snapshot?.quotes}
        predict={snapshot?.predict}
        onClear={filteredEmpty ? () => setSportFilter("ALL") : undefined}
        allCount={allGames.length}
      />
      <GameGrid
        comboLegs={comboLegs}
        onToggleLeg={toggleLeg}
        title="Later this week"
        empty={
          later.length
            ? ""
            : filteredEmpty
              ? ""
              : feedLooked
                ? "ESPN feed Looked empty on this pull — not a skip. Photograph a Hard Rock Bet Florida screen."
                : sportFilter && sportFilter !== "ALL"
                  ? `This filter is ${sportLabel(sportFilter)}. Nothing else later this week on that filter. Clear it to see All.`
                  : "Nothing else on the board this week. Horizon is this slate — not a skip."
        }
        games={later}
        rows={rows}
          picks={picks?.all}
        briefs={snapshot?.briefs}
        quotes={snapshot?.quotes}
        predict={snapshot?.predict}
      />
      {!games.length && sportFilter && sportFilter !== "ALL" ? <SportSeasonNote sport={sportFilter} /> : null}
      {feedLooked ? (
        <section className="paper-card p-5">
          <p className="stamp text-neon">Empty board</p>
          <h2 className="font-display mt-2 text-xl text-ink">No games on this slate.</h2>
          <p className="mt-2 text-sm text-muted">
            Off-slate or the ESPN feed Looked empty — not a skip. Photograph a Hard Rock Bet Florida screen so we still have a live number.
          </p>
        </section>
      ) : null}

      <details className="paper-card overflow-x-auto p-0" open>
<summary className="cursor-pointer bg-panel px-4 py-3 text-sm font-medium text-ink">
  All numbers on this board (Wide Open — delayed consensus prices)
</summary>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-panel text-muted">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th>When</th>
              <th>Type</th>
              <th>Public</th>
              <th>Hard Rock FL</th>
              <th>If it hits</th>
              <th>Edge</th>
              <th>Read</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, i) => (
              <tr key={`${r.eventId}-${r.selection}-${i}`} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link to="/game/$eventId" params={{ eventId: r.eventId }} className="font-medium text-ink underline-offset-4 hover:underline">
                    {shortPick(r.selection, r.marketType)}
                  </Link>
                  <p className="text-xs text-muted">
                    {sportLabel(r.sport)} · Away {r.away} · Home {r.home}
                  </p>
                </td>
                <td className="whitespace-nowrap text-xs text-muted">
                  {r.inPlay ? <LiveStamp row={r} /> : formatKickoff(r.start, true)}
                </td>
                <td>{MARKET_LABEL[r.marketType]}</td>
                <td className="font-mono tabular-nums">{formatAmerican(r.consensusPrice ?? r.price)}</td>
                <td className="font-mono tabular-nums">
                  {r.hardRockPrice != null ? formatAmerican(r.hardRockPrice) : "confirm on Hard Rock"}
                </td>
                <td>
                  <HitReadout chance={r.fairProb} price={r.hardRockPrice ?? r.price} heatTone={getEdgeTone(r.fairProb, null, r.hardRockPrice ?? r.price)} className="mt-0" align="left" />
                </td>
                <td className="tabular-nums">{Number.isFinite(r.evPct) ? formatPct(r.evPct, 1) : "—"}</td>
                <td className="text-xs text-muted">{TAG_LABEL[r.tag]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Bets vs money</h2>
        <p className="mt-2 text-sm text-muted">
          Ticket count (how many wagers) vs handle (how many dollars). When they split, the money is the sharp tell. We use it as a layer — we do not copy the public and we do not auto-fade it. Not Hard Rock's own book.
        </p>
        <ul className="mt-3 space-y-3">
          {splits.map((s) => {
            const tickets = s.ticketPct || s.publicPct;
            const money = s.handlePct ?? s.publicPct;
            return (
              <li key={`${s.eventId}-${s.side}`}>
                <div className="flex justify-between text-sm">
                  <span>
                    {s.side.replace(/\s+ML\b/gi, " to win")}
                    {s.steam ? " · steam" : ""}
                    {s.lean === "sharp" ? " · money lead" : s.lean === "public" ? " · public on tickets" : ""}
                  </span>
                  <span className="font-mono tabular-nums text-neon">
                    {tickets}% bets · {money}% $
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-obsidian">
                    <span className="block h-full bg-ink/50" style={{ width: `${tickets}%` }} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-obsidian">
                    <span className="block h-full bg-neon" style={{ width: `${money}%` }} />
                  </div>
                </div>
                {s.note ? <p className="mt-1 text-xs text-muted">{s.note}</p> : null}
              </li>
            );
          })}
        </ul>
        {!splits.length ? <p className="mt-2 text-sm text-muted">No ticket/handle split on this pull yet.</p> : null}
      </section>

      <p className="text-sm">
        Build a custom ticket on{" "}
        <Link to="/parlay" className="font-medium text-neon underline-offset-4 hover:underline">
          Your parlay
        </Link>
        .
      </p>
        </>
      )}
      {comboLegs.length > 1 && (
        <div className="fixed bottom-0 left-0 w-full bg-obsidian border-t border-neon p-4 z-50 shadow-2xl flex justify-between items-center">
          <p className="font-bold text-neon">Combo &bull; {comboLegs.length} Legs</p>
          <button
            onClick={handleBuildCombo}
            className="rounded-md bg-neon px-4 py-2 text-sm font-bold text-obsidian hover:bg-neon/90 transition-colors"
          >
            Build Parlay &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

function GameGrid({
  title,
  empty,
  games,
  rows,
  briefs,
  quotes,
  predict,
  onClear,
  allCount,
  picks,
  comboLegs,
  onToggleLeg,
}: {
  title: string;
  empty: string;
  games: ScanRow[];
  rows: ScanRow[];
  picks?: DeskPick[];
  briefs?: EventBrief[];
  quotes?: { eventId: string; awayRecord?: string; homeRecord?: string }[];
  predict?: PredictQuote[];
  onClear?: () => void;
  allCount?: number;
  comboLegs?: string[];
  onToggleLeg?: (eventId: string) => void;
}) {
  if (!games.length) {
    if (!empty) return null;
    return (
      <section>
        <h2 className="font-display mb-2 text-xl text-ink">{title}</h2>
        <p className="text-sm text-muted">{empty}</p>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="mt-3 inline-flex min-h-11 items-center rounded-md bg-neon px-4 text-sm font-medium text-obsidian"
          >
            Clear filter{allCount ? ` · ${allCount} on All` : ""}
          </button>
        ) : null}
      </section>
    );
  }

  const core = games.filter((g) => g.action === "enter_ticket");
  const lotto = games.filter((g) => g.action !== "enter_ticket");

  return (
    <section>
      <h2 className="font-display mb-1 text-xl text-ink">{title}</h2>

      {core.length > 0 && (
        <>
          {/* ── CORE 85% ── disciplined, high-edge plays */}
          <div className="mb-1 mt-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-neon/30" />
            <span className="text-xs font-semibold tracking-widest text-neon">
              CORE · 85% BANKROLL
            </span>
            <span className="h-px flex-1 bg-neon/30" />
          </div>
          <p className="mb-3 text-xs text-muted">
            Fair or better vs the consensus price. Disciplined plays only.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {core.map((g) => (
              <GameCard
                key={g.eventId}
                game={g}
                isCore
                briefs={briefs}
                quotes={quotes}
                predict={predict}
                rows={rows}
                isSelected={comboLegs?.includes(g.eventId)}
                onToggle={() => onToggleLeg?.(g.eventId)}
              />
            ))}
          </div>
        </>
      )}

      {lotto.length > 0 && (
        <>
          {/* ── FUN / LOTTO 15% ── high-variance, lower-edge plays */}
          <div className="mb-1 mt-5 flex items-center gap-2">
            <span className="h-px flex-1 bg-ink/20" />
            <span className="text-xs font-semibold tracking-widest text-muted">
              FUN / LOTTO · 15% BANKROLL
            </span>
            <span className="h-px flex-1 bg-ink/20" />
          </div>
          <p className="mb-3 text-xs text-muted">
            Priced over fair value — fun money only. Never the plan.
          </p>
          <div className="grid gap-3 opacity-75 md:grid-cols-2">
            {lotto.map((g) => (
              <GameCard
                key={g.eventId}
                game={g}
                isCore={false}
                briefs={briefs}
                quotes={quotes}
                predict={predict}
                rows={rows}
                isSelected={comboLegs?.includes(g.eventId)}
                onToggle={() => onToggleLeg?.(g.eventId)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function GameCard({
  game: g,
  isCore,
  briefs,
  quotes,
  predict,
  rows,
  picks,
  isSelected,
  onToggle,
}: {
  game: ScanRow;
  isCore: boolean;
  briefs?: EventBrief[];
  quotes?: { eventId: string; awayRecord?: string; homeRecord?: string }[];
  predict?: PredictQuote[];
  rows: ScanRow[];
  picks?: DeskPick[];
  isSelected?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
}) {
  const [fastLogOpen, setFastLogOpen] = React.useState(false);
  const existingPick = picks?.find((p) => p.eventId === g.eventId);
  if (existingPick) {
    return <PickCard pick={existingPick} featured={isCore} isSelected={isSelected} onToggle={onToggle} />;
  }
  const brief = briefs?.find((b) => b.eventId === g.eventId);
  const quote = quotes?.find((q) => q.eventId === g.eventId);
  const awayRec = brief?.awayRecord ?? quote?.awayRecord;
  const homeRec = brief?.homeRecord ?? quote?.homeRecord;
  const pred = predict?.find((p) => p.eventId === g.eventId);
  const fav = researchedFavorite(
    rows.filter((r) => r.eventId === g.eventId),
    brief,
    { home: g.home, away: g.away, kalshiHome: pred?.kalshiHome, polyHome: pred?.polyHome },
  );
  const lean = leanEnglish({
    home: g.home,
    away: g.away,
    oddsHome: g.side === "home" ? g.fairProb : 1 - g.fairProb,
    espnHome: brief?.espnHomeWin,
    ensembleHome: fav?.homeChance,
    crowdHome: pred?.kalshiHome ?? pred?.polyHome,
  });

  const awayLogo = g.awayLogo || (g.awayAbbr ? espnLogoUrl(g.sport, g.awayAbbr) : "");
  const homeLogo = g.homeLogo || (g.homeAbbr ? espnLogoUrl(g.sport, g.homeAbbr) : "");

  const isSharp = g.ticketPct != null && g.handlePct != null && (g.handlePct - g.ticketPct >= 15);

  return (
    <article className={cn("paper-card relative p-4", (isCore || g.inPlay) && "p-5 md:p-6", g.inPlay ? "ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-500 z-10" : (isCore || isSelected ? "ring-2 ring-neon" : ""))}>
      {isSharp && (
        <div className="absolute top-14 right-4 flex items-center gap-1.5 rounded-md bg-obsidian/90 px-2 py-1 text-xs font-bold text-neon ring-1 ring-neon/40 shadow-lg backdrop-blur-sm animate-pulse z-10">
          🔥 SHARP
        </div>
      )}
      <Link
        to="/game/$eventId"
        params={{ eventId: g.eventId }}
        className="block"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {onToggle && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(e);
                }}
                className={cn("flex size-5 items-center justify-center rounded-full border border-neon/50 bg-obsidian text-neon transition-colors", isSelected && "bg-neon text-obsidian")}
              >
                {isSelected ? "✓" : "+"}
              </button>
            )}
            <p className="stamp text-neon">
            {isCore ? "THE PLAY" : sportLabel(g.sport)}
            {g.phase === "preseason" ? " · Preseason" : g.phase === "playoff" ? " · Playoff" : ""}
          </p>
          </div>
          {(() => {
            const awayInit = (g.away || "A").charAt(0).toUpperCase();
            const homeInit = (g.home || "H").charAt(0).toUpperCase();
            return (
              <span className="flex -space-x-2">
                <span className="relative size-8 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-line flex items-center justify-center text-[11px] font-bold text-muted">{awayInit}</span>
                  {awayLogo ? <img src={awayLogo} alt="" className="relative size-8 rounded-full bg-panel object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                </span>
                <span className="relative size-8 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-line flex items-center justify-center text-[11px] font-bold text-muted">{homeInit}</span>
                  {homeLogo ? <img src={homeLogo} alt="" className="relative size-8 rounded-full bg-panel object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                </span>
              </span>
            );
          })()}
        </div>
        <LiveStamp row={g} className="mt-1 block" />
        <h3 className={cn("font-display mt-2 text-ink", isCore ? "text-2xl md:text-3xl" : "text-lg")}>
          {lean.title}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {g.start && !g.inPlay ? formatKickoff(g.start, true) : ""}
          {g.away && g.home ? ` · ${g.away}${awayRec ? ` (${awayRec})` : ""} @ ${g.home}${homeRec ? ` (${homeRec})` : ""}` : ""}
        </p>

        {isCore ? (
          <>
            {fav ? (
              <WagerMeter
                className="mt-3"
                size="lg"
                chance={fav.chance}
                price={g.price}
                heatTone={getEdgeTone(fav.chance, null, g.price)}
                label={`${fav.name} · % to hit`}
              />
            ) : Number.isFinite(g.fairProb) ? (
              <WagerMeter className="mt-3" size="lg" chance={g.fairProb} price={g.price} heatTone={getEdgeTone(g.fairProb, null, g.price)} />
            ) : null}
          </>
        ) : (
          <>
            {fav ? (
              <WagerMeter
                className="mt-3"
                size="sm"
                chance={fav.chance}
                price={g.price}
                heatTone={getEdgeTone(fav.chance, null, g.price)}
                label={`${fav.name} · % to hit`}
              />
            ) : Number.isFinite(g.fairProb) ? (
              <WagerMeter className="mt-3" size="sm" chance={g.fairProb} price={g.price} heatTone={getEdgeTone(g.fairProb, null, g.price)} />
            ) : null}
          </>
        )}

        <p className="mt-2 text-xs text-muted">
          {brief?.weather ?? ""}
          {brief?.injuryCount ? ` · ${brief.injuryCount} injury listings` : ""}
        </p>
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFastLogOpen(true); }} className="mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-neon/10 px-3 text-sm font-medium text-neon ring-1 ring-inset ring-neon/20 hover:bg-neon/20 cursor-pointer">⚡ Fast Log Ticket</div>
      </Link>
      {fastLogOpen && <FastLogModal item={g} onClose={() => setFastLogOpen(false)} />}
    </article>
  );
}
