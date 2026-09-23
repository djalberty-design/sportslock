// @ts-nocheck
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { useDeskStore } from "@/lib/desk-store";
import { pickFromScanRow, pickHero, pickInSport, safestColumn, sortByMood, type DeskMood, type DeskPick } from "@/lib/market/picks";
import { isCollegeSport } from "@/lib/market/universe";
import { sportLabel } from "@/lib/copy";
import { useAccess } from "@/lib/use-access";
import { SportFilter } from "./sport-filter";
import { PickCard } from "./pick-card";
import { SkeletonCard } from "./skeleton-card";
import { PhotoWagerCta } from "./photo-wager-cta";
import { MasterFilter, type BetType } from "./master-filter";
import { cn } from "@/lib/utils";

type Lane = "popular" | "prop" | "period" | "parlay";
type ParlayLane = "ribbon" | "sgp" | "two" | "three";

const LANES: { id: Lane; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "prop", label: "Players" },
  { id: "period", label: "Periods" },
  { id: "parlay", label: "Combos" },
];

const PARLAY_LANES: { id: ParlayLane; label: string }[] = [
  { id: "ribbon", label: "Ribbon" },
  { id: "two", label: "2-leg" },
  { id: "sgp", label: "Same-game" },
  { id: "three", label: "3-leg" },
];

const MOODS: { id: DeskMood; label: string; blurb: string }[] = [
  { id: "safe", label: "Safest", blurb: "Highest chance that still pays." },
  { id: "value", label: "Best value", blurb: "Best extra vs the book." },
  { id: "pay", label: "Pays more", blurb: "Longer prices." },
];

export function NowPage() {
  const { picks, query, snapshot, scan, ranking, rankMs, settings, remoteHidden } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const mood = useDeskStore((s) => s.deskMood) ?? "safe";
  const hideCollege = useDeskStore((s) => s.hideCollege);
  const hideLive = useDeskStore((s) => s.hideLive);
  const hiddenPickIds = useDeskStore((s) => s.hiddenPickIds);
  const pinnedPickId = useDeskStore((s) => s.pinnedPickId);
  const { isAdmin } = useAccess();
  const [lane, setLane] = useState<Lane>("popular");
  const [parlayLane, setParlayLane] = useState<ParlayLane>("ribbon");
  const [betType, setBetType] = useState<BetType>("all");
  const [sameGameOnly, setSameGameOnly] = useState(false);
  const [propsIncluded, setPropsIncluded] = useState(false);

  const sports = [...new Set((scan?.rows ?? []).map((r) => r.sport))];
  const inSport = (p: DeskPick) => {
    if (!pickInSport(p, sportFilter)) return false;
    if (hideCollege && (isCollegeSport(p.sport) || p.parlay?.sports?.some(isCollegeSport))) return false;
    return true;
  };

  const isLive = (p: DeskPick) => Boolean(p.row?.inPlay);
  const hideInPlay = (p: DeskPick) => (hideLive ? !isLive(p) : true);
  const notHidden = (p: DeskPick) => !hiddenPickIds.includes(p.id) && !remoteHidden.includes(p.id);
  const floor = mood === "safe" ? 0.52 : mood === "pay" ? 0.38 : 0.46;
  const popularPool = (picks?.popular ?? []).filter(inSport).filter(hideInPlay).filter((p) => !isLive(p)).filter(notHidden);
  const popularNamed = sortByMood(popularPool, mood).slice(0, 8);
  const popular =
    popularNamed.length
      ? popularNamed
      : sortByMood(
          (scan?.rows ?? [])
            .filter(
              (r) =>
                (r.marketType === "ml" || r.marketType === "spread" || r.marketType === "total") &&
                !r.isProp &&
                !r.inPlay &&
                r.tag !== "illegal_fl",
            )
            .map(pickFromScanRow)
            .filter(inSport),
          mood,
        ).slice(0, 8);
  const props = sortByMood((picks?.props ?? []).filter(inSport).filter(hideInPlay).filter((p) => !isLive(p)).filter(notHidden).filter((p) => p.chance >= floor || mood === "pay"), mood).slice(0, 6);
  const periods = sortByMood((picks?.periods ?? []).filter(inSport).filter(hideInPlay).filter((p) => !isLive(p)).filter(notHidden), mood).slice(0, 6);
  const sgp = sortByMood((picks?.sgp ?? []).filter(inSport).filter(notHidden), mood).slice(0, 6);
  const two = sortByMood((picks?.two ?? []).filter(inSport).filter(notHidden), mood).slice(0, 6);
  const three = sortByMood((picks?.three ?? []).filter(inSport).filter(notHidden), mood).slice(0, 6);
  const ribbon = (picks?.ribbon ?? []).filter(inSport).filter(notHidden).slice(0, 6);

  const singles = [picks?.hero, ...(picks?.popular ?? []), ...(picks?.props ?? []), ...(picks?.periods ?? [])]
    .filter((p): p is DeskPick => Boolean(p))
    .filter(inSport)
    .filter((p) => !isLive(p))
    .filter(notHidden);
  const gated = picks ? pickHero(singles, popular, mood) : null;
  const pinId = settings.pinnedPickId || pinnedPickId;
  const pinned = pinId ? singles.find((p) => p.id === pinId) ?? popular.find((p) => p.id === pinId) : null;
  const hero = pinned ?? gated;

  const hideHero = (list: DeskPick[]) => (hero ? list.filter((p) => p.id !== hero.id) : list);

  const laneItems: Record<Lane, DeskPick[]> = {
    popular: hideHero(popular),
    prop: hideHero(props),
    period: hideHero(periods),
    parlay:
      parlayLane === "ribbon"
        ? ribbon
        : parlayLane === "sgp"
          ? sgp
          : parlayLane === "three"
            ? three
            : two,
  };
  const laneCount: Record<Lane, number> = {
    popular: hideHero(popular).length,
    prop: hideHero(props).length,
    period: hideHero(periods).length,
    parlay: ribbon.length + sgp.length + two.length + three.length,
  };
  const laneBlurb: Record<Lane, string> = {
    popular: "Winners, spreads, and totals. Popular does not need The Call.",
    prop: "Player last-10 blended with season rate. College player bets are blocked in Florida.",
    period: "Innings, quarters, halves. Last-10 still feeds the game ensemble, then this slice is shrunk. Not The Call.",
    parlay: "Ribbon is 2- or 3-pick mains, always sorted Safest. 4-pick is Catalog / fun money on Combos — not this gold badge.",
  };
  const four = sortByMood((picks?.four ?? []).filter(inSport).filter(notHidden), mood).slice(0, 8);
  const tierPool = tierPoolFrom({
    betType,
    sameGameOnly,
    propsIncluded,
    popular,
    props,
    periods,
    sgp,
    two,
    three,
    four,
    heroId: hero?.id,
  });
  const safest = safestColumn(tierPool, 3, settings.safestFloor);
  const value = sortByMood(tierPool.filter((p) => !safest.some((s) => s.id === p.id) && (p.edge ?? 0) >= -0.01), "value").slice(0, 4);
  const pay = tierPool
    .filter((p) => p.price != null && p.price >= 130 && p.price <= 600 && (p.edge ?? 0) > 0)
    .sort((a, b) => b.decimalPayout - a.decimalPayout)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-emerald-500">Named tickets. Fast Log to lock the live price.</p>
        <h1 className="font-display mt-1 text-3xl text-ink md:text-4xl">AI Picks</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/80">
          Three columns. Not a guarantee. This site never places a bet.
        </p>
      </header>

      <SportFilter sports={sports} />
      <MasterFilter
        betType={betType}
        onBetType={setBetType}
        sameGameOnly={sameGameOnly}
        onSameGameOnly={setSameGameOnly}
        propsIncluded={propsIncluded}
        onPropsIncluded={setPropsIncluded}
      />

      {ranking ? (
        <p className="rounded-md bg-wash px-4 py-3 text-sm text-muted">
          Ranking tickets in the background. You can still tap around.
          {isAdmin && rankMs != null ? ` Last pass ${rankMs} ms.` : ""}
        </p>
      ) : isAdmin && rankMs != null ? (
        <p className="text-xs text-muted">Desk ranked in {rankMs} ms.</p>
      ) : null}

      {query.isError ? (
        <p className="rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500">
          Live board missing. Open Games after a refresh, or Fast Log.
        </p>
      ) : null}

            {!picks && !query.isError ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : null}

      {hero ? (
        <section>
          <h2 className="font-display text-2xl text-ink">The Call</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            {pinned
              ? "Pinned by admin. Still not a guarantee. This site never places a bet."
              : mood === "safe"
                ? "Highest-conviction gated single of the day. Still not a guarantee."
                : mood === "pay"
                  ? "Longer prices. Still not a guarantee."
                  : "Highest-conviction gated play of the day. Still not a guarantee."}
          </p>
          <PickCard pick={hero} featured />
        </section>
      ) : picks ? (
        <p className="text-sm text-muted">
          No Call tonight. Nothing cleared a strong look, a finished process file, and a price that is not worse than the book.
        </p>
      ) : null}

      {picks ? (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <TierColumn
              stamp="Safest"
              title="High probability"
              blurb="65% is the preferred floor. If nobody clears it, the highest-probability ticket still shows."
              empty="Nothing ranked yet on this filter. Best Value is next to this column."
              items={safest}
            />
            <TierColumn
              stamp="Best Value"
              title="Smart extra vs the fee"
              blurb="All the smart +EV plays. Still not a guarantee. This site never places a bet."
              empty="No Smart Value ticket cleared this filter."
              items={value}
            />
            <TierColumn
              stamp="Pays More"
              title="Longer prices"
              blurb="Plus-money +130 to +600 that still has an edge. Fun / lotto dollars."
              empty="No plus-money ticket with an edge on this filter."
              items={pay}
            />
          </div>
          <section>
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Market type">
              {LANES.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={lane === tab.id}
                  onClick={() => setLane(tab.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-md px-4 text-sm font-medium",
                    lane === tab.id ? "bg-emerald-500 text-zinc-950" : "bg-wash text-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                  {laneCount[tab.id] ? <span className="ml-1.5 tabular-nums opacity-70">· {laneCount[tab.id]}</span> : null}
                </button>
              ))}
            </div>
            {lane === "parlay" ? (
              <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Parlay type">
                {PARLAY_LANES.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={parlayLane === tab.id}
                    onClick={() => setParlayLane(tab.id)}
                    className={cn(
                      "min-h-11 shrink-0 rounded-md px-3 text-sm font-medium",
                      parlayLane === tab.id ? "bg-wash-gold text-emerald-500" : "bg-wash text-muted hover:text-ink",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-3 mb-3 text-sm text-muted">{laneBlurb[lane]}</p>
            {laneItems[lane].length ? (
              <ul className="grid gap-3 md:grid-cols-3">
                {laneItems[lane].slice(0, 6).map((pick, i) => (
                  <li key={pick.id}>
                    <PickCard pick={pick} rank={i + 1} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{laneEmptyCopy(lane, parlayLane, sportFilter)}</p>
            )}
          </section>

          <PhotoWagerCta what="wager" />
          <p className="rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500">
            Fast Log the ticket to confirm it on Log.
          </p>
          <p className="text-sm text-muted">
            Build your own mix on{" "}
            <Link to="/parlay" className="font-medium text-emerald-500 underline-offset-4 hover:underline">
              Combos
            </Link>
            . Open a game for the full Hard Rock sheet.
          </p>
        </>
      ) : null}

      {snapshot && !query.isError ? <p className="text-xs text-muted">{snapshot.hours.label}</p> : null}
    </div>
  );
}

function OpinionSkeleton() {
  return (
    <section className="paper-card p-6">
      <p className="stamp text-emerald-500">The Call</p>
      <p className="mt-3 text-muted">Reading live odds and every market on the sheet…</p>
    </section>
  );
}

function laneEmptyCopy(lane: Lane, parlayLane: ParlayLane, sportFilter: string): string {
  const name =
    lane === "parlay"
      ? (PARLAY_LANES.find((p) => p.id === parlayLane)?.label ?? "Parlays")
      : (LANES.find((l) => l.id === lane)?.label ?? "this lane");
  const sport = sportFilter && sportFilter !== "ALL" ? ` This filter is ${sportLabel(sportFilter)}.` : "";
  return `Nothing in ${name} on this delayed board.${sport} Clear the sport filter, or wait for the next slate.`;
}


function tierPoolFrom(opts: {
  betType: BetType;
  sameGameOnly: boolean;
  propsIncluded: boolean;
  popular: DeskPick[];
  props: DeskPick[];
  periods: DeskPick[];
  sgp: DeskPick[];
  two: DeskPick[];
  three: DeskPick[];
  four: DeskPick[];
  heroId?: string;
}): DeskPick[] {
  const singles = [...opts.popular, ...(opts.propsIncluded ? opts.props : []), ...opts.periods];
  const combos2 = [...opts.two, ...opts.sgp];
  let pool: DeskPick[] =
    opts.betType === "single"
      ? singles
      : opts.betType === "combo2"
        ? combos2
        : opts.betType === "combo3"
          ? opts.three
          : opts.betType === "combo4"
            ? opts.four
            : [...singles, ...combos2, ...opts.three, ...opts.four];
  if (opts.sameGameOnly) pool = pool.filter((p) => Boolean(p.parlay?.sameGame));
  const seen = new Set<string>();
  return pool.filter((p) => {
    if (opts.heroId && p.id === opts.heroId) return false;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function TierColumn({
  stamp,
  title,
  blurb,
  empty,
  items,
}: {
  stamp: string;
  title: string;
  blurb: string;
  empty: string;
  items: DeskPick[];
}) {
  return (
    <section>
      <p className="stamp text-emerald-500">{stamp}</p>
      <h2 className="font-display mt-1 text-xl text-ink">{title}</h2>
      <p className="mt-1 mb-3 text-sm text-muted">{blurb}</p>
      {items.length ? (
        <ul className="grid gap-3">
          {items.map((pick, i) => (
            <li key={pick.id}>
              <PickCard pick={pick} rank={i + 1} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}
