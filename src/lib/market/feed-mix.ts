import { ALL_SPORTS } from "./universe";

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

/** Gold ribbon first, then ranked catalog 2/3 + SGP. Does not loosen ribbon floors. */
export function buildFeedParlays(picks: {
  ribbon?: any[];
  two?: any[];
  three?: any[];
  sgp?: any[];
} | null | undefined): any[] {
  const ribbon = (picks?.ribbon ?? []).filter((p) => p?.parlay);
  const seen = new Set(ribbon.map((p) => String(p.id || "")));
  const gold = ribbon.map((p) => ({ ...p, feedLane: "gold" as const }));
  const catalog = [...(picks?.two ?? []), ...(picks?.three ?? []), ...(picks?.sgp ?? [])]
    .filter((p) => p?.parlay && !seen.has(String(p.id || "")))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map((p) => {
      seen.add(String(p.id || ""));
      return { ...p, feedLane: "catalog" as const };
    });
  return [...gold, ...catalog].slice(0, 12);
}
