import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { useDeskDecision } from "@/lib/market/use-board";
import {
  gradeParlay,
  matchParsedToRows,
  pickKey,
  rowToPick,
  researchedFavorite,
  sortByResearchedChance,
  uniqueUpcomingGames,
  enrichParlayPicks,
  type ParlayPick,
} from "@/lib/market/research";
import { candidateToPicks, deskPickFromLegRefs, lookupPick, parlayTicketId, parlayTicketIdFromLegs, shownParlayChance, shownParlayFromStoreLegs, type DeskPick } from "@/lib/market/picks";
import { parlayInfoQuality } from "@/lib/market/calibrate";
import { buildPropChance, parsePropSelection, propContextFromBrief, propStakeHaircut, teamWinForPlayer } from "@/lib/market/props";
import { getEventResearch } from "@/lib/market/server";
import { isKnownMarket, unknownMarketReason } from "@/lib/market/registry";
import { filterCatalog } from "@/lib/market/parlays";
import { isCollegeSport } from "@/lib/market/universe";
import { PickCard, ConfidenceChips } from "./pick-card";
import { LiveStamp } from "./live-stamp";
import type { EventBrief, ParlayCandidate, ParlayMix, ScanRow } from "@/lib/market/types";
import { formatKickoff } from "@/lib/utils";
import { formatBetUsd, shortPick, sportLabel } from "@/lib/copy";
import { ScreenshotIngest } from "./screenshot-ingest";
import { SportFilter, applySportFilter, SportSeasonNote } from "./sport-filter";
import { WagerMeter } from "./wager-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ParlayPage() {
  const legs = useDeskStore((s) => s.parlayLegs);
  const remove = useDeskStore((s) => s.removeParlayLeg);
  const clear = useDeskStore((s) => s.clearParlay);
  const add = useDeskStore((s) => s.addParlayLeg);
  const setParlayLegs = useDeskStore((s) => s.setParlayLegs);
  const unit = useDeskStore(selectUnit);
  const { scan, snapshot, picks, ranking } = useDeskDecision();
  const navigate = useNavigate();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const hideCollege = useDeskStore((s) => s.hideCollege);
  const hiddenPickIds = useDeskStore((s) => s.hiddenPickIds);
  const confirmed = useDeskStore((s) => s.confirmedTickets);
  const grade = legs.length ? gradeParlay(legs) : null;
  const rows = (scan?.rows ?? []).filter((r) => !(hideCollege && isCollegeSport(r.sport)));
  const sports = [...new Set(rows.map((r) => r.sport))];
  const games = sortByResearchedChance(
    applySportFilter(uniqueUpcomingGames(rows), sportFilter),
    rows,
    snapshot?.briefs,
    snapshot?.predict,
  );
  const ticketRef = useRef<HTMLElement>(null);
  const [scrollNonce, setScrollNonce] = useState(0);
  const loadedStamp = ticketStamp(legs);

  useEffect(() => {
    if (!scrollNonce) return;
    const node = document.getElementById("your-ticket") ?? ticketRef.current;
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollNonce, legs.length]);

  function applyTicket(next: ParlayPick[]) {
    const incoming = (next ?? []).filter(Boolean).filter((l) => !(l.marketType === "prop" && isCollegeSport(l.sport)));
    if (!incoming.length) return incoming;
    let ready = incoming;
    try {
      const enriched = enrichParlayPicks(incoming, rows, snapshot?.briefs, snapshot?.predict);
      if (Array.isArray(enriched) && enriched.length) ready = enriched;
    } catch {
      ready = incoming;
    }
    setParlayLegs(ready);
    setScrollNonce((n) => n + 1);
    return ready;
  }

  function loadFromUploads() {
    if (!confirmed.length || !scan) return;
    const next = applyTicket(matchParsedToRows(confirmed, scan.rows));
    if (next && next.length >= 2) {
      navigate({ to: "/ticket", search: { id: parlayTicketIdFromLegs(next) } });
    }
  }

  function loadCatalog(p: ParlayCandidate) {
    applyTicket(candidateToPicks(p, rows));
  }

  const ribbon = (picks?.ribbon ?? []).filter(
    (p) =>
      !hiddenPickIds.includes(p.id) &&
      !(hideCollege && (isCollegeSport(p.sport) || p.parlay?.sports?.some(isCollegeSport))),
  );

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-emerald-500">Two or more picks. They all have to hit.</p>
        <h1 className="font-display mt-2 text-3xl text-ink md:text-5xl">Parlay</h1>
        <p className="mt-3 text-base text-ink/80">
          We list 2- and 3-leg tickets with the best chance they all hit. You can also build your own. Fast Log the slip.
        </p>
      </header>
<SportFilter sports={sports} />

      {ranking ? (
        <p className="rounded-md bg-wash px-4 py-3 text-sm text-muted">
          Ranking tickets in the background. You can still tap around.
        </p>
      ) : null}

      {ribbon.length ? (
        <section>
          <h2 className="font-display text-2xl text-ink">AI ribbon</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Highest honest hit chance. Always sorted Safest. 2- or 3-leg mains only. No player props, no live, no college players, no 4-leg on the gold badge.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {ribbon.slice(0, 6).map((pick, i) => (
              <li key={pick.id}>
                <PickCard pick={pick} rank={i + 1} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ParlayCatalog
        scanTwos={scan?.topTwos ?? []}
        scanThrees={scan?.topThrees ?? []}
        scanFours={scan?.topFours ?? []}
        scanSgp={scan?.topSgp ?? []}
        sportFilter={sportFilter}
        loadedStamp={loadedStamp}
        onLoad={loadCatalog}
        ticket={
          <BuiltTicket
            refEl={ticketRef}
            grade={grade}
            legs={legs}
            scan={scan}
            snapshot={snapshot}
            onClear={clear}
            onRemove={remove}
          />
        }
      />

      <div className="rounded-lg border border-panel-border bg-obsidian p-4"><ScreenshotIngest kind="ticket" heading="Upload a Custom Parlay" /><p className="mt-2 text-xs text-muted">Only use this to upload a screenshot of a custom parlay that cannot be built on SportsLock.</p></div>

      {confirmed.length >= 2 ? (
        <Button type="button" variant="outline" onClick={loadFromUploads}>
          Run the {confirmed.length} confirmed legs through research
        </Button>
      ) : null}

      <section>
        <h2 className="font-display text-2xl text-ink">Add a game</h2>
        <p className="mt-1 mb-3 text-sm text-muted">Same sport filter as AI Picks and Games. Ranked by chance and payout together — not just the biggest favorite.</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {games.slice(0, 12).map((g) => {
            const on = legs.some((l) => l.eventId === g.eventId && l.marketType === "ml" && l.side === g.side);
            const fav = researchedFavorite(
              rows.filter((r) => r.eventId === g.eventId),
              snapshot?.briefs?.find((b) => b.eventId === g.eventId),
              { home: g.home, away: g.away },
            );
            return (
              <li key={g.eventId + g.side} className="paper-card flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="stamp text-emerald-500">{sportLabel(g.sport)}</p>
                  <LiveStamp row={g} className="mt-1 block" />
                  <p className="mt-1 font-medium text-ink">{shortPick(g.selection, g.marketType)}</p>
                  <p className="text-xs text-ink">
                    Away: {g.away} · Home: {g.home}
                  </p>
                  <p className="text-xs text-emerald-500">{formatKickoff(g.start, true)}</p>
                  <WagerMeter
                    className="mt-2"
                    size="sm"
                    chance={fav?.chance ?? g.fairProb}
                    price={g.price}
                    label={fav ? `${fav.name} · % to hit` : "% to hit"}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={on ? "outline" : "primary"}
                    onClick={() =>
                      on
                        ? remove(pickKey(g))
                        : add(enrichParlayPicks([rowToPick(g)], rows, snapshot?.briefs, snapshot?.predict)[0])
                    }
                  >
                    {on ? "Remove" : "Add"}
                  </Button>
                  <Link
                    to="/game/$eventId"
                    params={{ eventId: g.eventId }}
                    className="text-center text-xs text-emerald-500 underline-offset-4 hover:underline"
                  >
                    Research
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        {!games.length && sportFilter && sportFilter !== "ALL" ? <SportSeasonNote sport={sportFilter} /> : null}
      </section>

      <PlayerPropForm onAdd={add} rows={rows} briefs={snapshot?.briefs} unit={unit} />
    </div>
  );
}

function ParlayCatalog({
  scanTwos,
  scanThrees,
  scanFours,
  scanSgp,
  sportFilter,
  loadedStamp,
  onLoad,
  ticket,
}: {
  scanTwos: ParlayCandidate[];
  scanThrees: ParlayCandidate[];
  scanFours: ParlayCandidate[];
  scanSgp: ParlayCandidate[];
  sportFilter: string;
  loadedStamp?: string;
  onLoad: (p: ParlayCandidate) => void;
  ticket?: ReactNode;
}) {
  const [legs, setLegs] = useState<number | "all">("all");
  const [mix, setMix] = useState<ParlayMix | "all">("all");
  const [funMoney, setFunMoney] = useState(false);
  const bag = funMoney ? scanFours : [...scanTwos, ...scanThrees, ...scanSgp];
  const unfilteredMains = [...scanTwos, ...scanThrees, ...scanSgp];
  const filtered = filterCatalog(bag, {
    legs: funMoney ? 4 : legs,
    mix,
    sport: sportFilter && sportFilter !== "ALL" ? sportFilter : "ALL",
  }).slice(0, 18);
  const filterBits = [
    funMoney ? "4-leg Catalog / fun money" : legs !== "all" ? `${legs}-leg` : null,
    mix !== "all" ? (mix === "same-game" ? "same game" : mix === "cross-sport" ? "cross sport" : "same sport") : null,
    sportFilter && sportFilter !== "ALL" ? sportLabel(sportFilter) : null,
  ].filter(Boolean);
  const emptyWhy = !unfilteredMains.length
    ? "Ranked 2-leg mains are still filling from the board. Wait a beat, or Fast Log a slip below."
    : filterBits.length
      ? `This filter is ${filterBits.join(" · ")}. ${unfilteredMains.length} ranked slip${unfilteredMains.length === 1 ? "" : "s"} sit on All legs / Any mix. Clear the filter.`
      : "No ranked parlays on All / Any mix. Fast Log a slip or add legs below.";
  function clearCatalogFilter() {
    setFunMoney(false);
    setLegs("all");
    setMix("all");
  }
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-2xl text-ink">Ranked tickets</h2>
        <p className="mt-1 text-sm text-muted">
          2- and 3-leg. Same-game mains print joint-path or Thin · fallback-haircut on the ticket.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", 2, 3] as const).map((n) => (
          <Button
            key={String(n)}
            type="button"
            size="sm"
            variant={!funMoney && legs === n ? "primary" : "outline"}
            onClick={() => {
              setFunMoney(false);
              setLegs(n);
            }}
          >
            {n === "all" ? "All legs" : `${n}-leg`}
          </Button>
        ))}
        {(["all", "same-game", "same-sport", "cross-sport"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={!funMoney && mix === m ? "primary" : "outline"}
            onClick={() => {
              setFunMoney(false);
              setMix(m);
            }}
          >
            {m === "all" ? "Any mix" : m === "same-game" ? "Same game" : m === "same-sport" ? "Same sport" : "Cross sport"}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Catalog / fun money</p>
        <Button type="button" size="sm" variant={funMoney ? "primary" : "outline"} onClick={() => setFunMoney(true)}>
          4-leg
        </Button>
      </div>
      {ticket}
      {!filtered.length ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{emptyWhy}</p>
          {unfilteredMains.length > 0 && filterBits.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={clearCatalogFilter}>
              Clear this filter · {unfilteredMains.length} on All / Any mix
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((p, i) => {
            const names = p.legs.map((l) => shortPick(l.selection, l.marketType)).join(" + ");
            const stamp = p.legs.map((l) => `${l.eventId}:${l.marketType}:${l.side}`).sort().join("|");
            const on = Boolean(loadedStamp) && stamp === loadedStamp;
            return (
              <li key={`${p.title}-${names}-${i}`} className="paper-card flex flex-col p-4">
                <p className="stamp text-emerald-500">
                  {p.legs.length}-leg · {p.mix === "same-game" ? "same game" : p.mix === "cross-sport" ? "cross sport" : "same sport"}
                  {p.sports?.length ? ` · ${p.sports.map(sportLabel).join(" / ")}` : ""}
                </p>
                <p className="mt-2 font-medium text-ink">{names}</p>
                {p.sameGame ? (
                  <p className="mt-1 text-xs uppercase tracking-wide text-emerald-500">
                    {p.correlation === "shared-latent"
                      ? "Same-game joint-path"
                      : p.correlation === "fallback-haircut"
                        ? "Same-game Thin · fallback-haircut"
                        : "Same-game"}
                  </p>
                ) : null}
                <WagerMeter
                  className="mt-3"
                  size="sm"
                  chance={shownParlayChance(p)}
                  decimalPayout={p.decimalPayout}
                  label="% to hit all legs"
                />
                <ConfidenceChips
                  className="mt-2"
                  pick={
                    {
                      id: parlayTicketId(p),
                      selection: names,
                      chance: shownParlayChance(p),
                      infoQuality: parlayInfoQuality(p.legs.length, Boolean(p.sameGame)),
                      tapeStamp: p.researchOnly ? "research" : "hr-fl",
                      researchOnly: p.researchOnly,
                      parlay: p,
                    } as DeskPick
                  }
                />
                {p.sameGame ? <p className="mt-2 text-xs text-emerald-500">Same-game. They move together.</p> : null}
                <p className="mt-2 text-xs text-muted">{p.reason}</p>
                {p.pricedAsEntertainment ? <p className="mt-1 text-xs text-emerald-500">Fun money — not a plan.</p> : null}
                {on ? <p className="mt-1 text-xs text-muted">In your builder</p> : null}
                <Link
                  to="/ticket"
                  search={{ id: parlayTicketId(p) }}
                  onClick={() => onLoad(p)}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-500 px-3 text-sm font-medium text-zinc-950"
                >
                  {on ? "Loaded" : "Load this ticket"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LegResearchCard({ leg, index, onRemove }: { leg: ParlayPick; index: number; onRemove: () => void }) {
  const q = useQuery({
    queryKey: ["research", leg.eventId],
    queryFn: () => getEventResearch({ data: { eventId: leg.eventId } }),
    enabled: leg.eventId.startsWith("espn-"),
    staleTime: 120_000,
  });
  const research = q.data && q.data.ok ? q.data.research : null;
  const injuries = (research?.injuries ?? []).slice(0, 3);
  const last = research?.lastFive.find((b) => b.team === (leg.side === "home" ? leg.home : leg.away));
  const propLive =
    leg.marketType === "prop"
      ? buildPropChance({
          sport: leg.sport,
          selection: leg.selection,
          price: leg.price,
          player: leg.player,
          side: leg.side,
          point: leg.point,
          home: leg.home,
          away: leg.away,
          gameTotal: research?.total ?? undefined,
          homeSpread: research?.homeSpread,
          venue: research?.venue,
          weatherTemp: research?.weatherTemp,
          weatherWind: research?.weatherWind,
          weatherPrecip: research?.weatherPrecip,
          injuries: research?.injuries,
          ...propContextFromBrief(research ? { ...research, form: research.lastFive } : undefined, {
            home: leg.home,
            away: leg.away,
            player: leg.player,
          }),
        })
      : null;
  const prop = propLive ?? leg.propReport;
  const why =
    leg.marketType === "prop"
      ? prop?.because ?? "Player-bet model runs as soon as the ticket is confirmed."
      : research
        ? [
            research.espnHomeWin != null
              ? `ESPN model: ${leg.home} ${Math.round(research.espnHomeWin * 100)} in 100, ${leg.away} ${Math.round((research.espnAwayWin ?? 1 - research.espnHomeWin) * 100)} in 100.`
              : null,
            research.homeRecord || research.awayRecord
              ? `Records: ${leg.away} ${research.awayRecord ?? "—"} · ${leg.home} ${research.homeRecord ?? "—"}.`
              : null,
            research.pitchers[0] ? `Pitching: ${research.pitchers.map((p) => p.line).join(" vs ")}.` : null,
            last ? `Recent form (${last.team}): ${last.results.join(" ")}.` : null,
            research.weather ? `Weather: ${research.weather}.` : null,
          ]
            .filter(Boolean)
            .join(" ")
        : "Live matchup research loads next to this leg when the game is on the ESPN board.";

  return (
    <li className="paper-card p-4">
      <p className="stamp text-emerald-500">
        {sportLabel(leg.sport)} · Leg {index + 1}
        {leg.marketType === "prop" ? " · Player bet" : ""}
      </p>
      <p className="mt-1 font-medium text-ink">{shortPick(leg.selection, leg.marketType)}</p>
      <p className="text-sm text-ink">
        Away: {leg.away || "—"} · Home: {leg.home || "—"}
      </p>
      <p className="text-sm text-emerald-500">{leg.start ? formatKickoff(leg.start) : "Time TBA"}</p>
      <WagerMeter className="mt-3" size="sm" chance={leg.fairProb} price={leg.price} label="% to hit this leg" />
      <p className="mt-2 text-sm text-ink/90">{why}</p>
      {prop?.customize ? <p className="mt-2 text-sm text-emerald-500">{prop.customize}</p> : null}
      {injuries.length ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {injuries.map((inj, i) => (
            <li key={`${inj.player}-${i}`}>
              {inj.status} · {inj.player} ({inj.team}){inj.detail ? ` · ${inj.detail}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {leg.eventId.startsWith("espn-") ? (
          <Link
            to="/game/$eventId"
            params={{ eventId: leg.eventId }}
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
          >
            Full game research
          </Link>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

function PlayerPropForm({
  onAdd,
  rows,
  briefs,
  unit,
}: {
  onAdd: (leg: ParlayPick) => void;
  rows: ScanRow[];
  briefs?: EventBrief[];
  unit: number;
}) {
  const [sport, setSport] = useState("NFL");
  const [player, setPlayer] = useState("");
  const [team, setTeam] = useState("");
  const [opp, setOpp] = useState("");
  const [pick, setPick] = useState("");
  const [price, setPrice] = useState(-110);
  const [note, setNote] = useState(
    "NFL, NBA, MLB, NHL only. Fast Log the screen — we run the player-bet model on the live number. College player bets are blocked in Florida.",
  );

  function submit() {
    if (isCollegeSport(sport)) {
      setNote("College player bets are not allowed on Hard Rock Bet Florida.");
      return;
    }
    if (!player.trim() || !pick.trim()) {
      setNote("Need the player and the bet (example: over 249.5 passing yards).");
      return;
    }
    const selection = `${player.trim()} ${pick.trim()}`;
    if (!isKnownMarket(selection, "prop")) {
      setNote(unknownMarketReason(selection));
      return;
    }
    const parsed = parsePropSelection(selection, sport, { player: player.trim() });
    const game = rows.find((r) => {
      const a = (s: string) => s.toLowerCase();
      const t = a(team);
      const o = a(opp);
      return (
        (t && (a(r.home).includes(t) || a(r.away).includes(t))) ||
        (o && (a(r.home).includes(o) || a(r.away).includes(o)))
      );
    });
    const eventId = game?.eventId ?? `prop-${player.trim().replace(/\s+/g, "-")}`;
    const homeName = game?.home || opp.trim() || "Home";
    const awayName = game?.away || team.trim() || "Away";
    const gameRows = rows.filter((r) => r.eventId === eventId);
    const brief = briefs?.find((b) => b.eventId === eventId);
    const fav = researchedFavorite(gameRows, brief, { home: homeName, away: awayName });
    const report = buildPropChance({
      sport,
      selection,
      price,
      player: parsed.player,
      side: parsed.side,
      point: parsed.line,
      home: homeName,
      away: awayName,
      playerTeam: team.trim() || undefined,
      gameTotal: brief?.total ?? game?.total,
      homeSpread: brief?.homeSpread ?? game?.homeSpread,
      teamWinChance: teamWinForPlayer(homeName, awayName, team.trim() || undefined, fav?.homeChance),
      ...propContextFromBrief(brief, {
        home: homeName,
        away: awayName,
        player: parsed.player,
        playerTeam: team.trim() || undefined,
        stat: parsed.stat,
      }),
    });
    onAdd({
      key: pickKey({ eventId, marketType: "prop", side: parsed.side }),
      eventId,
      sport,
      start: game?.start ?? "",
      home: homeName,
      away: awayName,
      marketType: "prop",
      side: parsed.side,
      selection,
      price,
      fairProb: report.hit,
      point: parsed.line,
      player: parsed.player,
      propReport: report,
    });
    const size = unit > 0 ? ` Suggested stake about ${formatBetUsd(propStakeHaircut(unit))} (half a usual game bet).` : "";
    setNote(`${report.customize}${size}`);
    setPick("");
  }

  return (
    <section className="paper-card p-5">
      <h2 className="font-display text-xl text-ink">Add a player bet</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs uppercase tracking-[0.12em] text-muted">
          League
          <select
            className="mt-1 block h-11 w-full rounded-md bg-wash px-3 text-sm text-ink"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {["NFL", "NBA", "MLB", "NHL", "NCAAF", "NCAAB"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-[0.12em] text-muted">
          Player
          <Input className="mt-1" value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Patrick Mahomes" />
        </label>
        <label className="text-xs uppercase tracking-[0.12em] text-muted">
          His team
          <Input className="mt-1" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Kansas City" />
        </label>
        <label className="text-xs uppercase tracking-[0.12em] text-muted">
          Opponent
          <Input className="mt-1" value={opp} onChange={(e) => setOpp(e.target.value)} placeholder="Denver" />
        </label>
        <label className="text-xs uppercase tracking-[0.12em] text-muted md:col-span-2">
          The bet
          <Input className="mt-1" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="over 249.5 passing yards" />
        </label>
        <label className="text-xs uppercase tracking-[0.12em] text-muted">
          Odds
          <Input className="mt-1" inputMode="numeric" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
      </div>
      <Button className="mt-4" type="button" onClick={submit}>
        Run player-bet model
      </Button>
    </section>
  );
}

function ticketStamp(legs: ParlayPick[]): string {
  return legs.map((l) => `${l.eventId}:${l.marketType}:${l.side}`).sort().join("|");
}

function BuiltTicket({
  refEl,
  grade,
  legs,
  scan,
  snapshot,
  onClear,
  onRemove,
}: {
  refEl: { current: HTMLElement | null };
  grade: ReturnType<typeof gradeParlay> | null;
  legs: ParlayPick[];
  scan: import("@/lib/market/types").ScanBundle | null;
  snapshot: import("@/lib/market/types").DeskSnapshot | undefined;
  onClear: () => void;
  onRemove: (key: string) => void;
}) {
  if (!legs.length) {
    return (
      <section id="your-ticket" ref={refEl as never} className="paper-card p-5">
        <p className="stamp text-emerald-500">Builder</p>
        <h2 className="font-display mt-2 text-xl text-ink">Your ticket</h2>
        <p className="mt-2 text-sm text-muted">
          Load a ranked slip or add games below. Ribbon is 2- or 3-leg. 4-leg is Catalog / fun money.
        </p>
      </section>
    );
  }
  const legal = legs.filter((l) => !(l.marketType === "prop" && isCollegeSport(l.sport)));
  const ticketId = legal.length >= 2 ? parlayTicketIdFromLegs(legal) : "";
  const opened =
    legal.length >= 2 && scan && snapshot
      ? (lookupPick(ticketId, scan, snapshot) ?? deskPickFromLegRefs(legal, scan))
      : null;
  const combined = opened?.chance ?? shownParlayFromStoreLegs(legal);
  return (
    <section id="your-ticket" ref={refEl as never} className="space-y-3">
      <div className="paper-card p-5">
        <p className="stamp text-emerald-500">Builder</p>
        <h2 className="font-display mt-2 text-xl text-ink">{opened?.selection ?? grade?.headline ?? `${legs.length}-leg ticket`}</h2>
        {combined != null ? (
          <WagerMeter
            className="mt-3"
            size="md"
            chance={combined}
            decimalPayout={opened?.decimalPayout ?? grade?.decimalPayout}
            label="% to hit all legs"
          />
        ) : null}
        {opened?.parlay?.correlation || grade?.correlation ? (
          <p className="mt-2 text-xs uppercase tracking-wide text-emerald-500">
            {(opened?.parlay?.correlation ?? grade?.correlation) === "shared-latent"
              ? "Same-game joint-path"
              : (opened?.parlay?.correlation ?? grade?.correlation) === "fallback-haircut"
                ? "Same-game Thin · fallback-haircut"
                : "Near-independent"}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ink/90">{opened?.why ?? grade?.because}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {legal.length >= 2 && ticketId ? (
            <Link
              to="/ticket"
              search={{ id: ticketId }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-500 px-4 text-sm font-medium text-zinc-950"
            >
              Open ticket
            </Link>
          ) : (
            <p className="text-sm text-muted">Add one more legal leg to open a ticket page.</p>
          )}
          <Button type="button" size="sm" variant="outline" onClick={onClear}>
            Clear ticket
          </Button>
        </div>
      </div>
      <ol className="grid gap-3">
        {legs.map((leg, i) => (
          <LegResearchCard key={leg.key} leg={leg} index={i} onRemove={() => onRemove(leg.key)} />
        ))}
      </ol>
    </section>
  );
}
