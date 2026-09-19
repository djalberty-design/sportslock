/** ET slate window + matchup sort. Today first; tomorrow only after today is done. */

const ET = "America/New_York";

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function etDayKey(input?: string | number | Date | null): string | null {
  if (input == null || input === "") return null;
  const t = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(t.getTime())) return null;
  return t.toLocaleDateString("en-CA", { timeZone: ET });
}

export function nowEtDayKey(now = new Date()): string {
  return etDayKey(now) || "1970-01-01";
}

export function nextEtDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + 1));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export type SlateGame = {
  eventId?: string;
  sport?: string;
  start?: string;
  inPlay?: boolean;
  complete?: boolean;
  statusText?: string;
  home?: string;
  away?: string;
};

export function isFinalish(g: SlateGame | null | undefined): boolean {
  if (!g) return false;
  if (g.complete) return true;
  if (g.inPlay) return false;
  const st = String(g.statusText || "").toLowerCase();
  return /(final|official|game over|completed|closed)/.test(st);
}

export function startMs(g: SlateGame | null | undefined): number {
  const t = Date.parse(String(g?.start || ""));
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** Live first (earliest start), then pregame earliest → latest. */
export function sortDeskGames<T extends SlateGame>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const al = a.inPlay && !isFinalish(a) ? 0 : 1;
    const bl = b.inPlay && !isFinalish(b) ? 0 : 1;
    if (al !== bl) return al - bl;
    const ds = startMs(a) - startMs(b);
    if (ds) return ds;
    return String(a.eventId || "").localeCompare(String(b.eventId || ""));
  });
}

export function hasRemainingToday<T extends SlateGame>(games: T[], now = new Date()): boolean {
  const today = nowEtDayKey(now);
  return games.some((g) => {
    if (isFinalish(g)) return false;
    if (g.inPlay) return true;
    return etDayKey(g.start) === today;
  });
}

export function onSlateDay<T extends SlateGame>(g: T, games: T[], now = new Date()): boolean {
  if (g.inPlay && !isFinalish(g)) return true;
  if (isFinalish(g)) return false;
  const today = nowEtDayKey(now);
  const day = etDayKey(g.start);
  if (!day) return false;
  if (day === today) return true;
  if (day < today) return false;
  if (day === nextEtDayKey(today)) return !hasRemainingToday(games, now);
  return false;
}

export function filterSlateGames<T extends SlateGame>(games: T[], now = new Date()): T[] {
  return sortDeskGames(games.filter((g) => onSlateDay(g, games, now)));
}
