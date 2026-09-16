import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { SkeletonCard } from "./skeleton-card";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeskDecision } from "@/lib/market/use-board";
import {
  candidateToPicks,
  correlationFlag,
  deskPickFromLegRefs,
  lookupPick,
  matchLegRow,
  parseParlayTicketId,
  parlayTicketIdFromLegs,
  pickFromScanRow,
  pickMatchup,
  qualityBand,
  resolveTicketId,
  ribbonSitWhy,
  type DeskPick,
} from "@/lib/market/picks";
import { assembleChanceInput, rowToPick } from "@/lib/market/research";
import { getEventResearch } from "@/lib/market/server";
import { buildChance } from "@/lib/market/chance";
import { buildPropChance, parsePropSelection, propContextFromBrief, rateFromStats, teamWinForPlayer } from "@/lib/market/props";
import { rulesFor, ruleStamp, DESK_VERSION, type RuleApplies } from "@/lib/market/rules";
import { analyzeScores, formatFormRead, formatScoreLine } from "@/lib/market/form";
import { formatBetUsd, formatChancePct, sportLabel, shortPick } from "@/lib/copy";
import { LOOK_LABEL } from "@/lib/plain-words";
import { formatAmerican, formatKickoff } from "@/lib/utils";
import { isCollegeSport } from "@/lib/market/universe";
import { buildUsage } from "@/lib/market/usage";
import { WagerMeter } from "./wager-meter";
import { LiveBanner, LiveStamp } from "./live-stamp";
import { TapeStrip } from "./play-card";
import { ScreenshotIngest, PhotoFirstNote } from "./screenshot-ingest";
import { PhotoWagerCta } from "./photo-wager-cta";
import { ConfidenceChips, EdgeRow } from "./pick-card";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { buildLockPayload, LockedStamp } from "./ticket-lock";
import { Button } from "@/components/ui/button";
import type { DeskSnapshot, EventBrief, PaperTicket, ParsedTicket, ScanBundle, ScanRow } from "@/lib/market/types";

export function TicketPage({ ticketId }: { ticketId: string }) {
  const { scan, snapshot, query } = useDeskDecision();
  const unit = useDeskStore(selectUnit);
  const add = useDeskStore((s) => s.addParlayLeg);
  const resolvedId = resolveTicketId(ticketId);
  const pick = (() => {
    if (scan && snapshot) {
      const hit = lookupPick(resolvedId, scan, snapshot) ?? (ticketId !== resolvedId ? lookupPick(ticketId, scan, snapshot) : null);
      if (hit) return hit;
      const refs = parseParlayTicketId(resolvedId) ?? parseParlayTicketId(ticketId);
      if (refs && refs.length >= 2) return deskPickFromLegRefs(refs, scan);
    }
    return null;
  })();
  const eventId = pick?.eventId ?? pick?.parlay?.legs[0]?.eventId;
  const researchQ = useQuery({
    queryKey: ["research", eventId],
    queryFn: () => getEventResearch({ data: { eventId: eventId! } }),
    enabled: Boolean(eventId?.startsWith("espn-")) && !pick?.parlay,
    staleTime: 120_000,
  });
  const research = researchQ.data && researchQ.data.ok ? researchQ.data.research : null;

  if ((query.isLoading || !scan) && !pick) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (!pick) {
    return (
      <div className="space-y-4">
        <BackLink parlay={resolvedId.startsWith("p") || ticketId.startsWith("p")} />
        <p className="text-ink">That ticket is not on today’s board.</p>
        <PhotoWagerCta what="wager" />
      </div>
    );
  }

  if (pick.parlay && scan && snapshot) {
    return <ParlayTicketView pick={pick} scan={scan} snapshot={snapshot} />;
  }

  const rows = (scan?.rows ?? []).filter((r) => r.eventId === pick.eventId);
  const brief = snapshot?.briefs?.find((b) => b.eventId === pick.eventId);
  const predict = snapshot?.predict?.find((p) => p.eventId === pick.eventId);
  const player = pick.player
    ? (brief?.players ?? research?.players ?? []).find((p) => p.name === pick.player)
    : undefined;
  const parsedProp = pick.row
    ? parsePropSelection(pick.row.selection, pick.sport, {
        player: pick.row.player,
        point: pick.row.point,
        side: pick.row.side,
      })
    : null;
  const report = pick.eventId
    ? buildChance(
        assembleChanceInput({
          rows,
          brief,
          research: research ?? undefined,
          predict,
          extra: {
            ticketHome: brief?.ticketHome,
            handleHome: brief?.handleHome,
            steam: brief?.steam,
          },
          home: pick.home,
          away: pick.away,
        }),
      )
    : null;
  const prop =
    pick.row && (pick.row.isProp || pick.row.marketType === "prop")
      ? buildPropChance({
          sport: pick.sport,
          selection: pick.row.selection,
          price: pick.row.price,
          player: pick.row.player,
          side: pick.row.side,
          point: pick.row.point,
          home: pick.home ?? "",
          away: pick.away ?? "",
          playerTeam: player?.team,
          gameTotal: brief?.total ?? pick.row.total,
          homeSpread: brief?.homeSpread ?? pick.row.homeSpread,
          venue: brief?.venue ?? research?.venue,
          weatherTemp: brief?.weatherTemp ?? research?.weatherTemp,
          weatherWind: brief?.weatherWind ?? research?.weatherWind,
          weatherPrecip: brief?.weatherPrecip ?? research?.weatherPrecip,
          injuries: brief?.injuries ?? research?.injuries,
          teamWinChance: teamWinForPlayer(pick.home ?? "", pick.away ?? "", player?.team, brief?.chanceHome ?? report?.home),
          seasonRate: parsedProp ? rateFromStats(parsedProp.stat, player?.stats) : undefined,
          recentRate: parsedProp && player?.recentStats ? rateFromStats(parsedProp.stat, player.recentStats) : undefined,
          recentN: player?.recentN,
          ...propContextFromBrief(brief ?? (research ? { ...research, form: research.lastFive } : undefined), {
            home: pick.home ?? "",
            away: pick.away ?? "",
            player: pick.row.player ?? parsedProp?.player,
            playerTeam: player?.team,
            stat: parsedProp?.stat,
          }),
        })
      : null;

  const layers = mergeLayers(report, prop);

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="max-w-2xl">
        <p className="text-sm text-gold">
          {bucketLabel(pick)} · {sportLabel(pick.sport)}
          {pick.row?.inPlay ? " · Live" : ""}
        </p>
        <h1 className="font-display mt-2 text-3xl text-ink md:text-4xl">{pick.selection}</h1>
        <p className="mt-2 text-sm text-gold">
          {pick.start ? formatKickoff(pick.start) : ""}
          {pick.away && pick.home ? ` · ${pickMatchup(pick)}` : ""}
        </p>
        <p className="mt-3 text-sm text-ink/80">
          Chance it hits, at your This ticket amount. Not a guarantee. Photograph Hard Rock to lock the live price.
        </p>
      </header>

      <section className="paper-card p-5 md:p-6">
        <p className="stamp text-gold">The ticket</p>
        <WagerMeter
          className="mt-4"
          size="lg"
          chance={pick.chance}
          price={pick.price}
          decimalPayout={pick.decimalPayout}
          label={pick.parlay ? "Chance every leg hits" : "Chance it hits"}
        />
        {pick.implied != null ? <EdgeRow pick={pick} className="mt-4" /> : null}
        <ConfidenceChips pick={pick} className="mt-3" />
        {pick.row?.inPlay ? (
          <div className="mt-3 space-y-2">
            <LiveStamp row={pick.row} className="block" />
            <LiveBanner row={pick.row} />
          </div>
        ) : null}
        <SimLine pick={pick} />
        {pick.processSource ? (
          <p className="mt-2 text-xs text-muted">
            {pick.processLooked
              ? `On-field file not in yet (Looked). ${pick.processSource}.`
              : `On-field file is in (Ran). ${pick.processSource}.`}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">{callWhy(pick)}</p>
        <p className="mt-4 text-sm text-ink/90">{pick.why}</p>
        <TapeStrip ticketPct={pick.ticketPct} handlePct={pick.handlePct} lean={pick.tapeLean} note={pick.tapeNote} />
      </section>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Why the algorithm named this</h2>
        <p className="mt-2 text-sm text-ink/90">{algorithmBecause(pick, report?.because, prop?.because)}</p>
        {layers.length ? (
          <LayerList layers={layers} />
        ) : (
          <p className="mt-3 text-sm text-muted">
            Open the game sheet for the full layer stack on this matchup. Period and player tickets inherit the same
            game ensemble, then apply the period shrink or the player model.
          </p>
        )}
        <p className="mt-4 text-xs text-gold">
          {LOOK_LABEL[qualityBand(pick.infoQuality)]}
          {report ? ` · ${report.layers.length} looks · agreement ${Math.round(report.agreement * 100)} in 100` : ""}
          {pick.chance ? ` · ticket ${formatChancePct(pick.chance)}` : ""}
        </p>
      </section>

      <ContextPanel brief={brief} researchInjuries={research?.injuries} player={player} pick={pick} form={brief?.form ?? research?.lastFive} />

      <RulesRan
        kind={pick.bucket === "prop" ? "prop" : pick.parlay ? "parlay" : pick.bucket === "period" ? "period" : "game"}
        layers={layers}
      />

      <PhotoFirstNote venue="Hard Rock Bet Florida" />
      <ScreenshotIngest kind="ticket" heading={`Upload a screenshot of ${pick.selection}`} />

      <div className="flex flex-wrap gap-3">
        {pick.row ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-md bg-gold px-4 text-sm font-medium text-navy-deep"
            onClick={() => add(rowToPick(pick.row!))}
          >
            Add to parlay
          </button>
        ) : null}
        {pick.eventId ? (
          <Link
            to="/game/$eventId"
            params={{ eventId: pick.eventId }}
            className="inline-flex min-h-11 items-center text-sm font-medium text-gold underline-offset-4 hover:underline"
          >
            Hard Rock sheet
          </Link>
        ) : (
          <Link to="/parlay" className="inline-flex min-h-11 items-center text-sm font-medium text-gold underline-offset-4 hover:underline">
            Open Parlay
          </Link>
        )}
      </div>

      <PhotoWagerCta what="other number on this game" />
    </div>
  );
}

function ParlayTicketView({
  pick,
  scan,
  snapshot,
}: {
  pick: DeskPick;
  scan: ScanBundle;
  snapshot: DeskSnapshot;
}) {
  const parlay = pick.parlay!;
  const unit = useDeskStore(selectUnit);
  const setParlayLegs = useDeskStore((s) => s.setParlayLegs);
  const place = useDeskStore((s) => s.placePaperTicket);
  const navigate = useNavigate();
  const [locked, setLocked] = useState<PaperTicket | null>(null);
    const [lockError, setLockError] = useState<string | null>(null);
    const [stake, setStake] = React.useState(5);
  const [legPrices, setLegPrices] = React.useState<number[]>(() => parlay.legs.map((l) => l.price || -110));

  const decimal = legPrices.reduce((acc, p) => acc * (p > 0 ? (p / 100) + 1 : (100 / Math.abs(p)) + 1), 1);
  const combinedPrice = Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1));

  useEffect(() => {
    const next = candidateToPicks(parlay, scan.rows).filter(
      (l) => !(l.marketType === "prop" && isCollegeSport(l.sport)),
    );
    setParlayLegs(next);
    // Only the open ticket id should refill the builder. `parlay` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick.id is the contract
  }, [pick.id, setParlayLegs]);

  const usedSim = parlay.correlation === "shared-latent";
  const closed = parlay.legs.some((l) => {
    const row = matchLegRow(scan.rows, l);
    return row && !row.isProp && (row.marketType === "ml" || row.marketType === "spread" || row.marketType === "total") && row.simFair == null;
  });

  function removeLeg(index: number) {
    const next = parlay.legs.filter((_, i) => i !== index);
    setParlayLegs(candidateToPicks({ ...parlay, legs: next }, scan.rows));
    if (next.length < 2) {
      navigate({ to: "/parlay" });
      return;
    }
    navigate({ to: "/ticket", search: { id: parlayTicketIdFromLegs(next) } });
  }

  function lockToLog() {
    const items: ParsedTicket[] = parlay.legs.map((l, i) => ({
      sport: l.sport,
      home: l.home,
      away: l.away,
      marketType: l.marketType,
      side: l.side,
      selection: l.selection,
      price: legPrices[i],
      start: l.start,
      confidence: 1,
      confirmed: true,
    }));
    const payload = buildLockPayload(items, scan.rows, stake);
    const res = place({ ...payload, price: combinedPrice, fastLog: true, fairAtLock: pick.chance, tapeSource: pick.tapeStamp });
    if (res.ok) {
      setLocked(res.ticket);
      setLockError(null);
    } else {
      setLockError(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink parlay />
      <header className="max-w-2xl">
        <p className="text-sm text-gold">
          {bucketLabel(pick)} · {parlay.legs.length}-leg
          {parlay.sports?.length ? ` · ${parlay.sports.map(sportLabel).join(" / ")}` : ""}
        </p>
        <h1 className="font-display mt-2 text-3xl text-ink md:text-4xl">{pick.selection}</h1>
        <ol className="mt-3 space-y-1 text-sm text-ink/90">
          {parlay.legs.map((leg, i) => (
            <li key={`${leg.eventId}-${leg.selection}-${i}`}>
              <span className="stamp text-gold">Leg {i + 1}</span>{" "}
              {shortPick(leg.selection, leg.marketType)} · {sportLabel(leg.sport)} · {formatKickoff(leg.start)}
              <span className="text-muted">
                {" "}
                · {leg.away} at {leg.home}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink/80">
          Chance they all hit. Not a guarantee. Photograph Hard Rock to lock the live price. This site never places a bet.
        </p>
      </header>

      <section className="paper-card p-5 md:p-6">
        <p className="stamp text-gold">The slip</p>
        <WagerMeter
          className="mt-4"
          size="lg"
          chance={pick.chance}
          decimalPayout={pick.decimalPayout}
          label="Chance every leg hits"
        />
        {pick.implied != null ? <EdgeRow pick={pick} className="mt-4" /> : null}
        <ConfidenceChips pick={pick} className="mt-3" />
        <p className="mt-3 text-xs uppercase tracking-wide text-gold">
          {correlationFlag(parlay.correlation, parlay.sameGame)}
        </p>
        {usedSim ? (
          <p className="mt-2 text-xs text-muted">
            Joint chance from seeded paths on registered mains. Displayed capped at 99%. Never 100%.
          </p>
        ) : closed || parlay.correlation === "fallback-haircut" ? (
          <p className="mt-2 text-xs text-muted">
            A leg could not sim. Closed form on the slip, quality capped at 0.64. No fake sim %.
            {parlay.correlation === "fallback-haircut" ? " Haircut table is fallback only — stamped Thin + fallback-haircut." : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">Near-independent games. Combined chance is the product of each leg. Displayed capped at 99%.</p>
        )}
        <p className="mt-2 text-xs text-muted">{ribbonSitWhy(pick, scan.rows)}</p>
        <p className="mt-4 text-sm text-ink/90">{pick.why}</p>
      </section>

      <RulesRan
        kind="parlay"
        layers={[
          { id: "sgp" },
          { id: "latent", empty: !usedSim, thin: parlay.correlation === "fallback-haircut" },
          { id: "sim", empty: !usedSim, thin: parlay.correlation === "fallback-haircut" },
        ]}
      />

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-ink">Each leg</h2>
        <p className="text-sm text-muted">Same breakdown a single ticket gets. Open this leg for the dedicated page.</p>
        <ol className="grid gap-3">
          {parlay.legs.map((leg, i) => {
            const row = matchLegRow(scan.rows, leg);
            return (
              <li key={`${leg.eventId}-${leg.selection}-${i}`}>
                <LegBlock
                  index={i}
                  row={row}
                  fallback={leg}
                  snapshot={snapshot}
                  scan={scan}
                  onRemove={() => removeLeg(i)}
                />
              </li>
            );
          })}
        </ol>
      </section>

      {locked ? <LockedStamp ticket={locked} /> : null}

      <div className="mt-6 rounded-xl bg-panel p-4 shadow-2xl border border-panel-border text-ink ring-1 ring-neon/20">
                <div className="flex justify-between items-end border-b border-panel-border pb-2 mb-4">
          <div>
            <p className="text-xs text-muted font-bold uppercase">Combo • {parlay.legs.length} Legs</p>
            <p className="text-lg font-bold">Combined Odds</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-mono-numbers text-neon">{combinedPrice > 0 ? `+${combinedPrice}` : combinedPrice}</p>
          </div>
        </div>
        
        <div className="space-y-4 mb-4">
          <div>
            <label className="text-xs text-muted font-bold uppercase block">Wager</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input 
                type="number" 
                value={stake} 
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full rounded-md bg-obsidian border border-panel-border py-2 pl-7 pr-3 font-mono-numbers text-ink focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
              />
            </div>
          </div>
          
          <div className="pt-3 border-t border-panel-border/50">
            <label className="text-xs text-muted font-bold uppercase mb-2 block">Leg Odds</label>
            <div className="space-y-2">
              {parlay.legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-obsidian p-2 border border-panel-border">
                                    <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm text-ink/90 truncate font-medium" title={leg.selection}>{leg.selection}</span>
                    <span className="text-xs text-muted uppercase truncate">
                      {leg.marketType} {leg.side} {leg.line != null ? (leg.line > 0 ? "+" + leg.line : leg.line) : ""}
                    </span>
                  </div>
                  <div className="w-24 shrink-0">
                    <input 
                      type="number" 
                      value={legPrices[i]} 
                      onChange={(e) => {
                        const next = [...legPrices];
                        next[i] = Number(e.target.value);
                        setLegPrices(next);
                      }}
                      className="w-full rounded-md bg-panel border border-panel-border py-1 px-2 font-mono-numbers text-neon focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon text-right text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="pt-2 border-t border-panel-border flex justify-between items-center mb-4">
          <p className="text-sm text-muted font-bold uppercase">To Win</p>
          <p className="text-xl font-mono-numbers text-ink">${(stake * ((Number(combinedPrice) > 0 ? (Number(combinedPrice) / 100) + 1 : (100 / Math.abs(Number(combinedPrice))) + 1) - 1)).toFixed(2)}</p>
        </div>

        <button 
          onClick={lockToLog}
          className="w-full flex min-h-12 items-center justify-center rounded-lg bg-neon text-obsidian font-bold text-lg hover:bg-neon/90 transition-colors shadow-[0_0_15px_rgba(57,255,20,0.4)]"
        >
          ⚡ Lock It
        </button>
      </div>

      {lockError ? <p className="mt-4 text-sm text-gold text-center">{lockError}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          to="/parlay"
          className="inline-flex min-h-11 items-center rounded-md bg-wash px-4 text-sm font-medium text-ink"
        >
          Add a leg
        </Link>
        <Link to="/parlay" className="inline-flex min-h-11 items-center text-sm font-medium text-gold underline-offset-4 hover:underline">
          Back to Parlay
        </Link>
      </div>
    </div>
  );
}

function LegBlock({
  index,
  row,
  fallback,
  snapshot,
  scan,
  onRemove,
}: {
  index: number;
  row?: ScanRow;
  fallback: { eventId: string; sport: string; selection: string; marketType: ScanRow["marketType"]; side: string; price: number; fairProb: number; start: string; home: string; away: string };
  snapshot: DeskSnapshot;
  scan: ScanBundle;
  onRemove: () => void;
}) {
  const standDown = !row || row.tag === "unknown_market" || row.tag === "illegal_fl";
  const pick = row ? pickFromScanRow(row) : null;
  const eventId = row?.eventId ?? fallback.eventId;
  const researchQ = useQuery({
    queryKey: ["research", eventId],
    queryFn: () => getEventResearch({ data: { eventId } }),
    enabled: Boolean(eventId?.startsWith("espn-")),
    staleTime: 120_000,
  });
  const research = researchQ.data && researchQ.data.ok ? researchQ.data.research : null;
  const brief = snapshot.briefs?.find((b) => b.eventId === eventId);
  const predict = snapshot.predict?.find((p) => p.eventId === eventId);
  const gameRows = scan.rows.filter((r) => r.eventId === eventId);
  const player = pick?.player
    ? (brief?.players ?? research?.players ?? []).find((p) => p.name === pick.player)
    : undefined;
  const parsedProp = row
    ? parsePropSelection(row.selection, row.sport, { player: row.player, point: row.point, side: row.side })
    : null;
  const report = eventId
    ? buildChance(
        assembleChanceInput({
          rows: gameRows,
          brief,
          research: research ?? undefined,
          predict,
          extra: { ticketHome: brief?.ticketHome, handleHome: brief?.handleHome, steam: brief?.steam },
          home: row?.home ?? fallback.home,
          away: row?.away ?? fallback.away,
        }),
      )
    : null;
  const prop =
    row && (row.isProp || row.marketType === "prop")
      ? buildPropChance({
          sport: row.sport,
          selection: row.selection,
          price: row.price,
          player: row.player,
          side: row.side,
          point: row.point,
          home: row.home,
          away: row.away,
          playerTeam: player?.team,
          gameTotal: brief?.total ?? row.total,
          homeSpread: brief?.homeSpread ?? row.homeSpread,
          venue: brief?.venue ?? research?.venue,
          weatherTemp: brief?.weatherTemp ?? research?.weatherTemp,
          weatherWind: brief?.weatherWind ?? research?.weatherWind,
          weatherPrecip: brief?.weatherPrecip ?? research?.weatherPrecip,
          injuries: brief?.injuries ?? research?.injuries,
          teamWinChance: teamWinForPlayer(row.home, row.away, player?.team, brief?.chanceHome ?? report?.home),
          seasonRate: parsedProp ? rateFromStats(parsedProp.stat, player?.stats) : undefined,
          recentRate: parsedProp && player?.recentStats ? rateFromStats(parsedProp.stat, player.recentStats) : undefined,
          recentN: player?.recentN,
          ...propContextFromBrief(brief ?? (research ? { ...research, form: research.lastFive } : undefined), {
            home: row.home,
            away: row.away,
            player: row.player ?? parsedProp?.player,
            playerTeam: player?.team,
            stat: parsedProp?.stat,
          }),
        })
      : null;
  const layers = mergeLayers(report, prop);
  const kind: RuleApplies = row?.isProp || row?.marketType === "prop" ? "prop" : isPeriodSel(row?.selection ?? fallback.selection) ? "period" : "game";

  return (
    <article className="paper-card space-y-4 p-5">
      <header>
        <p className="stamp text-gold">
          Leg {index + 1} · {sportLabel(row?.sport ?? fallback.sport)}
          {standDown ? " · stood down" : ""}
        </p>
        <h3 className="font-display mt-2 text-xl text-ink">{shortPick(row?.selection ?? fallback.selection, row?.marketType ?? fallback.marketType)}</h3>
        <p className="mt-1 text-sm text-gold">
          {formatKickoff(row?.start ?? fallback.start)} · {row?.away ?? fallback.away} at {row?.home ?? fallback.home}
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          {formatAmerican(row?.price ?? fallback.price)} · {row?.marketType ?? fallback.marketType}
        </p>
      </header>
      {standDown ? (
        <p className="text-sm text-gold">
          {row?.tag === "illegal_fl"
            ? "This leg is not a legal Florida ticket (college player). Stood down. Combined still opened."
            : "This leg could not be priced on the delayed board (unknown market or missing row). Stood down. Combined still opened."}
        </p>
      ) : null}
      {pick ? (
        <>
          <WagerMeter className="mt-1" size="sm" chance={pick.chance} price={pick.price} label="This leg" />
          {pick.implied != null ? <EdgeRow pick={pick} /> : null}
          <SimLine pick={pick} />
          {pick.processSource ? (
            <p className="text-xs text-muted">
              Process {pick.processLooked ? "Looked" : "Ran"} · {pick.processSource}
            </p>
          ) : null}
        </>
      ) : (
        <WagerMeter className="mt-1" size="sm" chance={fallback.fairProb} price={fallback.price} label="This leg" />
      )}
      {layers.length ? <LayerList layers={layers} /> : null}
      <RulesRan kind={kind} layers={layers} />
      {pick ? (
        <ContextPanel
          brief={brief}
          researchInjuries={research?.injuries}
          player={player}
          pick={pick}
          form={brief?.form ?? research?.lastFive}
        />
      ) : null}
      <div className="flex flex-wrap gap-3">
        {pick ? (
          <Link
            to="/ticket"
            search={{ id: pick.id }}
            className="inline-flex min-h-11 items-center text-sm font-medium text-gold underline-offset-4 hover:underline"
          >
            Open this leg
          </Link>
        ) : null}
        {eventId.startsWith("espn-") ? (
          <Link
            to="/game/$eventId"
            params={{ eventId }}
            className="inline-flex min-h-11 items-center text-sm font-medium text-gold underline-offset-4 hover:underline"
          >
            Hard Rock sheet
          </Link>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onRemove}>
          Remove this leg
        </Button>
      </div>
    </article>
  );
}

function isPeriodSel(sel: string): boolean {
  return /inning|quarter|1st half|2nd half|\bperiod\b|f5|first 5/i.test(sel);
}

function SimLine({ pick }: { pick: DeskPick }) {
  if (pick.simFair != null) {
    return (
      <p className="mt-2 text-xs text-muted">
        Our sim vs the market pool. Sim {Math.round(pick.simFair * 100)}% · pool {pick.poolFair != null ? `${Math.round(pick.poolFair * 100)}%` : "—"}. Displayed capped at 99%.
      </p>
    );
  }
  if (pick.poolFair != null) {
    return (
      <p className="mt-2 text-xs text-muted">
        Closed form (sim did not emit) · pool {Math.round(pick.poolFair * 100)}% · quality capped at 0.64. No fake sim %.
      </p>
    );
  }
  return null;
}

type Layer = { id: string; label: string; note: string; value: string; thin?: boolean; empty?: boolean };

function mergeLayers(
  report: ReturnType<typeof buildChance>,
  prop: ReturnType<typeof buildPropChance> | null,
): Layer[] {
  const gameLayers =
    report?.layers.map((l) => ({
      id: l.id,
      label: l.label,
      note: l.note,
      value: `${Math.round(l.home * 100)}% home`,
      thin: l.thin,
      empty: l.empty,
    })) ?? [];
  const propLayers =
    prop?.layers.map((l) => ({
      id: l.id,
      label: l.label,
      note: l.note,
      value: `${Math.round(l.p * 100)}%`,
      thin: l.thin,
      empty: l.empty,
    })) ?? [];
  if (prop?.illegal || prop?.standDown) return propLayers;
  if (!propLayers.length) return gameLayers;
  const map = new Map<string, Layer>();
  for (const l of gameLayers) map.set(l.id, l);
  for (const l of propLayers) map.set(l.id, l);
  return [...map.values()];
}

function LayerList({ layers }: { layers: Layer[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {layers.map((l) => (
        <li key={l.id} className="rounded-md bg-wash px-3 py-2">
          <p className="flex justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{l.label}</span>
            <span className="tabular-nums text-gold">{l.value}</span>
          </p>
          <p className="mt-1 text-xs text-muted">{l.note}</p>
        </li>
      ))}
    </ul>
  );
}

function algorithmBecause(pick: DeskPick, gameBecause?: string, propBecause?: string): string {
  if (pick.bucket === "prop") {
    return (
      propBecause ??
      "Player model on top of the game ensemble: last-10 of THIS stat (EWMA, 60/40 with season), opponent-adjusted defense, minutes/usage, pitcher-vs-batter, and underlying process. The photographed book number is the prior when we have it. Not a lock."
    );
  }
  if (pick.bucket === "period") {
    return `One inning / quarter / half is noisier than the full game, so this chance is shrunk toward 50/50 versus the full-game ensemble. ${gameBecause ?? "Looks are pooled in log-odds. The sportsbook close is the prior."} Not a lock.`;
  }
  if (pick.parlay) return pick.why;
  return (
    gameBecause ??
    "Looks are pooled in log-odds. The sportsbook close is the prior. Prediction markets, ESPN, form, injuries, weather, park, rest, and bets-vs-money (ticket count vs handle) are layers. Public tickets are never copied. Not a lock."
  );
}

function ContextPanel({
  brief,
  researchInjuries,
  player,
  pick,
  form,
}: {
  brief?: EventBrief;
  researchInjuries?: Array<{ team: string; player: string; status: string; detail?: string }>;
  player?: {
    name: string;
    position: string;
    team: string;
    starter?: boolean;
    stats: Record<string, number>;
    recentStats?: Record<string, number>;
    recentN?: number;
  };
  pick: DeskPick;
  form?: Array<{ team: string; line: string; results: string[]; games?: Array<{ date?: string; result: string; pf?: number; pa?: number; opponent?: string }> }>;
}) {
  const injuries = brief?.injuries ?? researchInjuries ?? [];
  const usage = pick.eventId
    ? buildUsage({
        eventId: pick.eventId,
        sport: pick.sport,
        players: brief?.players,
        injuries,
      })
    : undefined;
  const usageOut = usage?.players.filter((p) => p.standDown).slice(0, 6) ?? [];
  const usageLeft = usage?.players.filter((p) => !p.standDown && p.opportunity > 0.5).slice(0, 4) ?? [];
  const weatherBits = [
    brief?.weather,
    brief?.weatherTemp != null ? `${Math.round(brief.weatherTemp)}°` : null,
    brief?.weatherWind != null && brief.weatherWind >= 8 ? `wind ${Math.round(brief.weatherWind)} mph` : null,
    brief?.weatherPrecip != null && brief.weatherPrecip >= 20 ? `rain ${Math.round(brief.weatherPrecip)}%` : null,
  ].filter(Boolean);
  const rest =
    brief?.homeRestDays != null || brief?.awayRestDays != null
      ? `Rest: home ${brief?.homeRestDays ?? "—"}d · away ${brief?.awayRestDays ?? "—"}d`
      : null;
  const records =
    brief?.homeRecord || brief?.awayRecord
      ? `Records: ${pick.away ?? "away"} ${brief?.awayRecord ?? "—"} at ${pick.home ?? "home"} ${brief?.homeRecord ?? "—"}`
      : null;
  const outs =
    (brief?.homeOuts ?? 0) + (brief?.awayOuts ?? 0) > 0
      ? `Listed out: home ${brief?.homeOuts ?? 0} · away ${brief?.awayOuts ?? 0}`
      : null;
  const stats = player
    ? Object.entries(player.stats)
        .filter(([, v]) => Number.isFinite(v))
        .slice(0, 8)
    : [];
  const recent = player?.recentStats
    ? Object.entries(player.recentStats)
        .filter(([, v]) => Number.isFinite(v))
        .slice(0, 8)
    : [];
  if (
    !weatherBits.length &&
    !brief?.venue &&
    !records &&
    !rest &&
    !outs &&
    !injuries.length &&
    !stats.length &&
    !brief?.series &&
    !form?.length &&
    !usage
  ) {
    return null;
  }
  return (
    <section className="paper-card p-5">
      <h2 className="font-display text-xl text-ink">Everything on this ticket</h2>
      <p className="mt-2 text-sm text-muted">
        Games and players. Live ESPN log — analysis, not a generated card. Still photograph the live number.
      </p>
      {form?.length ? (
        <div className="mt-4 space-y-3">
          <p className="stamp text-gold">Last 10 scores — analysis</p>
          {form.map((block) => {
            const read = analyzeScores(block.games ?? [], 10);
            return (
              <div key={block.team} className="rounded-md bg-wash px-3 py-2">
                <p className="text-sm font-medium text-ink">{block.team}</p>
                {read ? <p className="mt-1 text-sm text-ink/90">{formatFormRead(read, block.team)}</p> : null}
                <p className="mt-1 text-xs text-muted">{block.games?.length ? formatScoreLine(block.games) : block.line}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm text-ink/90">
        {brief?.venue ? <li>Park / venue: {brief.venue}</li> : null}
        {weatherBits.length ? <li>Weather: {weatherBits.join(" · ")}</li> : null}
        {records ? <li>{records}</li> : null}
        {brief?.series ? <li>Series: {brief.series}</li> : null}
        {rest ? <li>{rest}</li> : null}
        {outs ? <li>{outs}</li> : null}
        {brief?.homeEra != null || brief?.awayEra != null ? (
          <li>
            ERA: home {brief?.homeEra?.toFixed?.(2) ?? "—"} · away {brief?.awayEra?.toFixed?.(2) ?? "—"}
          </li>
        ) : null}
      </ul>
      {player ? (
        <div className="mt-4 rounded-md bg-wash px-3 py-2">
          <p className="stamp text-gold">Player</p>
          <p className="mt-1 font-medium text-ink">
            {player.name}
            {player.position ? ` · ${player.position}` : ""}
            {player.starter ? " · starter" : ""}
            {player.team ? ` · ${player.team}` : ""}
          </p>
          {stats.length ? (
            <p className="mt-1 text-xs text-muted">
              Season · {stats.map(([k, v]) => `${k} ${typeof v === "number" && v < 10 ? v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : v}`).join(" · ")}
            </p>
          ) : null}
          {recent.length ? (
            <p className="mt-1 text-xs text-gold">
              Last {player.recentN ?? 10} · {recent.map(([k, v]) => `${k} ${typeof v === "number" ? v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") : v}`).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {injuries.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {injuries.slice(0, 8).map((i) => (
            <li key={`${i.team}-${i.player}`} className="text-ink/90">
              <span className="text-gold">{i.status}</span> · {i.player}
              {i.team ? ` (${i.team})` : ""}
              {i.detail ? ` — ${i.detail}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {usage ? (
        <div className="mt-4 rounded-md bg-wash px-3 py-2">
          <p className="stamp text-gold">
            Usage {usage.empty || !(brief?.players && brief.players.length) ? "Looked" : usage.thin ? "Thin" : "Ran"}
            {usage.empty || !(brief?.players && brief.players.length)
              ? " · leftover opportunity Looked"
              : " / leftover opportunity"}
          </p>
          <p className="mt-1 text-xs text-muted">{usage.note}</p>
          {usage.empty || !(brief?.players && brief.players.length) ? (
            <p className="mt-1 text-sm text-ink/90">
              No depth chart on this pull. Count-of-outs is a game look, not usage. We do not invent a backup.
            </p>
          ) : null}
          {usageOut.map((p) => (
            <p key={p.id} className="mt-1 text-sm text-ink/90">
              {p.note}
            </p>
          ))}
          {usageLeft.map((p) => (
            <p key={p.id} className="mt-1 text-sm text-ink/90">
              {p.name} leftover opportunity {(p.opportunity * 100).toFixed(0)}%
              {p.position ? ` · ${p.position}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function bucketLabel(pick: DeskPick): string {
  switch (pick.bucket) {
    case "prop":
      return "Player ticket";
    case "period":
      return "Period ticket";
    case "sgp":
      return "Same-game parlay";
    case "parlay2":
      return "2-game parlay";
    case "parlay3":
      return "3-game parlay";
    case "parlay4":
      return "4-game parlay";
    default:
      return "Popular";
  }
}

function BackLink({ parlay = false }: { parlay?: boolean }) {
  return (
    <Link
      to={parlay ? "/parlay" : "/today"}
      className="inline-flex min-h-11 items-center gap-1 text-sm text-gold"
    >
      <ChevronLeft className="size-4" strokeWidth={1.75} />
      {parlay ? "Parlay" : "AI Picks"}
    </Link>
  );
}

function callWhy(pick: DeskPick): string {
  if (pick.parlay) return "A parlay cannot be The Call. Ribbon parlays live on Parlay as the high-hit badge.";
  if (pick.row?.inPlay) return "Live tickets cannot be The Call. They rank on Live with a quality haircut.";
  if (pick.bucket === "period") return "Period slices cannot be The Call. Quality floor keeps them off the gold badge.";
  if (pick.decimalPayout < 1.55) return "Pays less than decimal 1.55 — not The Call.";
  if (pick.chance < 0.5 || pick.chance > 0.76) return "Displayed chance outside 50–76% — not The Call.";
  if (pick.infoQuality < 0.72) return "Not a strong look — not The Call.";
  if (pick.processLooked !== false) {
    return `Process ${pick.processSource ?? "look"} is Looked — not The Call. ${pick.processSource ?? "The process file"} only stamps Ran when that file is posted.`;
  }
  if (pick.implied != null && pick.chance < pick.implied - 0.01 && (pick.edge ?? 0) <= 0) {
    return "Desk % is more than 1 pt under the book with no positive edge — not The Call.";
  }
  return "Eligible for The Call when it ranks first among singles that still pay.";
}

function RulesRan({
  kind,
  layers,
}: {
  kind: RuleApplies;
  layers: Array<{ id: string; thin?: boolean; empty?: boolean; label?: string }>;
}) {
  const rules = rulesFor(kind);
  return (
    <section className="paper-card p-5">
      <h2 className="font-display text-xl text-ink">Rules the desk ran</h2>
      <p className="mt-2 text-sm text-muted">
        Every rule looks up live data every time. Thin = live lookup, small sample. Looked = feed empty, not a skip and not a guess. Desk {DESK_VERSION}. No dice.
      </p>
      <ol className="mt-3 space-y-2">
        {rules.map((r) => {
          const stamp = ruleStamp(r, layers);
          const source = r.id === "process" ? layers.find((l) => l.id === "process")?.label : undefined;
          return (
            <li key={r.id} className="rounded-md bg-wash px-3 py-2">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink">
                  {r.title}
                  {source ? ` · ${source}` : ""}
                </span>
                <span className="stamp text-gold">{stamp}</span>
              </p>
              <p className="mt-1 text-xs text-muted">{r.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
