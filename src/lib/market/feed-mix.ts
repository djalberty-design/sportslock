import { ALL_SPORTS } from "./universe";
import { etDayKey, filterSlateGames, nextEtDayKey, nowEtDayKey, type SlateGame } from "./slate-day";

export type MixFilter = "ALL" | "SGP" | "SAME_SPORT" | "CROSS" | "LEG2" | "LEG3";

export const MIX_OPTIONS: { id: MixFilter; label: string }[] = [
  { id: "ALL", label: "All mixes" },
  { id: "SGP", label: "Same game" },
  { id: "SAME_SPORT", label: "Same sport" },
  { id: "CROSS", label: "Cross sport" },
  { id: "LEG2", label: "2-leg" },
  { id: "LEG3", label: "3-leg" },
];

export function ribbonLegs(pick: any): any[] {
  if (Array.isArray(pick?.parlay?.legs)) return pick.parlay.legs;
  if (Array.isArray(pick?.legs)) return pick.legs;
  return [];
}

export function snapshotSports(snapshot: any): string[] {
  const live = new Set<string>();
  for (const row of snapshot?.quotes ?? []) {
    const sport = String(row?.sport || "");
    if (sport && sport !== "SYS") live.add(sport);
  }
  for (const row of snapshot?.briefs ?? []) {
    const sport = String(row?.sport || "");
    if (sport && sport !== "SYS") live.add(sport);
  }
  const known = ALL_SPORTS.filter((s) => live.has(s));
  const extras = [...live].filter((s) => !(ALL_SPORTS as readonly string[]).includes(s));
  return [...known, ...extras];
}

export function classifyMix(pick: any): {
  sameGame: boolean;
  sameSport: boolean;
  cross: boolean;
  legs: number;
  label: string;
} {
  const legs = ribbonLegs(pick);
  const n = legs.length || 1;
  const events = new Set(legs.map((l) => l?.eventId).filter(Boolean));
  const sports = new Set(
    [...legs.map((l) => l?.sport), pick?.sport, pick?.parlay?.sports].flat().filter(Boolean),
  );
  if (Array.isArray(pick?.parlay?.sports)) {
    for (const s of pick.parlay.sports) if (s) sports.add(s);
  }
  const sameGame = Boolean(pick?.parlay?.sameGame) || pick?.bucket === "sgp" || (n >= 2 && events.size === 1);
  const sameSport = sports.size <= 1;
  const cross = sports.size > 1;
  const label = sameGame ? "Same game" : cross ? "Cross sport" : n >= 2 ? "Same sport" : "Straight";
  return { sameGame, sameSport, cross, legs: n, label };
}

export function applyRibbonSportFilter<T>(rows: T[], sportFilter: string | undefined): T[] {
  if (!sportFilter || sportFilter === "ALL") return rows;
  return rows.filter((pick: any) => {
    if (pick?.sport === sportFilter) return true;
    return ribbonLegs(pick).some((l) => l?.sport === sportFilter);
  });
}

function snapshotGames(snapshot: any): SlateGame[] {
  const map = new Map<string, SlateGame>();
  for (const row of [...(snapshot?.quotes ?? []), ...(snapshot?.briefs ?? [])]) {
    const eventId = String(row?.eventId || "");
    if (!eventId) continue;
    const prev = map.get(eventId) || { eventId };
    map.set(eventId, {
      ...prev,
      eventId,
      sport: row.sport || prev.sport,
      start: row.start || prev.start,
      inPlay: Boolean(row.inPlay || prev.inPlay),
      complete: Boolean(row.complete || prev.complete),
      statusText: row.statusText || prev.statusText,
      home: row.home || prev.home,
      away: row.away || prev.away,
    });
  }
  return [...map.values()];
}

export function applySlateDayFilter<T>(rows: T[], snapshot: any): T[] {
  const games = filterSlateGames(snapshotGames(snapshot));
  const allowed = new Set(games.map((g) => g.eventId));
  const today = nowEtDayKey();
  const tomorrow = nextEtDayKey(today);
  const allowTomorrow = !games.some((g) => etDayKey(g.start) === today || g.inPlay);
  return rows.filter((pick: any) => {
    const legs = ribbonLegs(pick);
    const ids = legs.map((l) => l?.eventId).filter(Boolean);
    if (!ids.length) {
      const start = pick?.row?.start || pick?.start;
      const day = etDayKey(start);
      if (!day) return false;
      if (day === today) return true;
      if (day === tomorrow) return allowTomorrow;
      return false;
    }
    return ids.every((id) => allowed.has(id));
  });
}

export function applyMixFilter<T>(rows: T[], mix: MixFilter | undefined): T[] {
  if (!mix || mix === "ALL") return rows;
  return rows.filter((pick) => {
    const c = classifyMix(pick);
    if (mix === "SGP") return c.sameGame;
    if (mix === "SAME_SPORT") return c.sameSport && !c.sameGame && c.legs >= 2;
    if (mix === "CROSS") return c.cross;
    if (mix === "LEG2") return c.legs === 2;
    if (mix === "LEG3") return c.legs === 3;
    return true;
  });
}

/**
 * Value-based feed ranking.
 * Filters out extreme favorites (-500 and heavier) and no-edge picks.
 * Gold ribbon = best value parlay. Catalog = top 10 by value score.
 * Value score balances probability, payout, and edge — not just safety.
 */
function feedValueFilter(pick: any): boolean {
  const legs = (pick?.parlay?.legs ?? pick?.legs ?? [pick?.row]).filter(Boolean);
  // Filter out picks where ANY leg is an extreme favorite
  for (const leg of legs) {
    const price = leg?.price ?? leg?.hardRockPrice ?? 0;
    if (price < -400) return false; // -400 or heavier per leg = no value
  }
  // Check COMBINED parlay odds — individual legs at -300 can combine to -2500
  const combinedDec = pick?.decimalPayout ?? pick?.parlay?.decimalPayout ?? 0;
  if (combinedDec > 0 && combinedDec < 1.25) return false; // Worse than -400 combined = terrible value
  // Also check by combined price directly
  const combinedPrice = pick?.price ?? 0;
  if (combinedPrice < -400) return false;
  // Require minimum edge
  const edge = pick?.edge ?? pick?.parlay?.edge ?? 0;
  const chance = pick?.chance ?? pick?.parlay?.combinedFair ?? 0;
  // Don't show coin-flip garbage (< 35% combined probability)
  if (chance < 0.35 && !pick?.parlay) return false;
  // Don't show anything above 85% probability (heavy favorites, no value)
  if (chance > 0.85) return false;
  return true;
}

export function buildFeedParlays(picks: {
  ribbon?: any[];
  two?: any[];
  three?: any[];
  sgp?: any[];
} | null | undefined): any[] {
  const ribbon = (picks?.ribbon ?? []).filter((p) => p?.parlay).filter(feedValueFilter);
  const sortedRibbon = ribbon.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  // Gold: top 1 by score (only if meeting strict criteria, otherwise empty)
  const gold = sortedRibbon.slice(0, 1).map((p) => ({ ...p, feedLane: "gold" as const }));
  const seen = new Set(gold.map((p) => String(p.id || "")));

  // Catalog: remaining from ribbon + all two, three, sgp
  const catalogPool = [
    ...sortedRibbon.slice(1),
    ...(picks?.two ?? []),
    ...(picks?.three ?? []),
    ...(picks?.sgp ?? []),
  ];

  const catalog = catalogPool
    .filter((p) => p?.parlay && !seen.has(String(p.id || "")))
    .filter(feedValueFilter)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 36)
    .map((p) => {
      seen.add(String(p.id || ""));
      return { ...p, feedLane: "catalog" as const };
    });

  return [...gold, ...catalog];
}
