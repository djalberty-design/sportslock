import { buildLiveSnapshot } from "./live-board";
import { applyLiveScores, fetchLiveScores, teamsMatch, type LiveScore } from "./live-scores";
import { etDayKey, nowEtDayKey } from "./slate-day";
import type { DeskSnapshot, QuoteLine } from "./types";

function isFinishedQuote(q: QuoteLine): boolean {
  if ((q as { complete?: boolean }).complete) return true;
  const st = String(q.statusText || "").toLowerCase();
  if (/(final|official|game over|completed|closed)/.test(st)) return true;
  if (q.inPlay) return false;
  const start = Date.parse(String(q.start || ""));
  if (!Number.isFinite(start)) return false;
  const ageH = (Date.now() - start) / 3_600_000;
  const sport = String(q.sport || "");
  const limit = sport === "NCAAF" || sport === "NFL" ? 4.25 : 2.85;
  return ageH >= limit;
}

function occupyingScores(scores: LiveScore[], sport: string, team?: string) {
  if (!team) return [];
  return scores.filter(
    (s) =>
      (s.inPlay || s.complete || s.scheduled) &&
      (!s.sport || !sport || s.sport === sport) &&
      (teamsMatch(s.home, team, s.homeAbbr) || teamsMatch(s.away, team, s.awayAbbr)),
  );
}

function stalePairing(home: string, away: string, sport: string, scores: LiveScore[]): boolean {
  const hits = [...occupyingScores(scores, sport, home), ...occupyingScores(scores, sport, away)];
  if (!hits.length) return false;
  return hits.some((s) => {
    const same = teamsMatch(s.home, home, s.homeAbbr) && teamsMatch(s.away, away, s.awayAbbr);
    const flip = teamsMatch(s.home, away, s.homeAbbr) && teamsMatch(s.away, home, s.awayAbbr);
    return !same && !flip;
  });
}

export function dropFinishedGames(snap: DeskSnapshot, scores: LiveScore[] = []): DeskSnapshot {
  const today = nowEtDayKey();
  const done = new Set<string>();

  for (const q of snap.quotes) {
    if (isFinishedQuote(q)) done.add(q.eventId);
    if (stalePairing(q.home, q.away, q.sport, scores)) done.add(q.eventId);
    const day = etDayKey(q.start);
    if (!q.inPlay && day && day < today) done.add(q.eventId);
  }

  const quoted = new Set(snap.quotes.map((q) => q.eventId));
  for (const b of snap.briefs ?? []) {
    const sport = String((b as { sport?: string }).sport || "");
    const home = String((b as { home?: string }).home || "");
    const away = String((b as { away?: string }).away || "");
    if (stalePairing(home, away, sport, scores)) done.add(b.eventId);
    const day = etDayKey((b as { start?: string }).start);
    if (day && day < today) done.add(b.eventId);
    if (!quoted.has(b.eventId) && (!day || day !== today)) done.add(b.eventId);
  }

  if (!done.size) return snap;
  return {
    ...snap,
    quotes: snap.quotes.filter((q) => !done.has(q.eventId)),
    briefs: (snap.briefs ?? []).filter((b) => !done.has(b.eventId)),
  };
}

export async function snapshotWithLiveScores(asOf?: string): Promise<DeskSnapshot> {
  const snap = await buildLiveSnapshot(asOf);
  const scores = await fetchLiveScores().catch(() => []);
  if (!scores.length) return dropFinishedGames(snap);
  const liveN = scores.filter((s) => s.inPlay).length;
  const withLive = {
    ...snap,
    quotes: applyLiveScores(snap.quotes, scores),
    sourceNote: liveN
      ? `${snap.sourceNote} Live scores: ${liveN} in play.`
      : snap.sourceNote,
  };
  return dropFinishedGames(withLive, scores);
}
