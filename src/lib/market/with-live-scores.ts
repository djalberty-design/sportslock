import { buildLiveSnapshot } from "./live-board";
import { applyLiveScores, fetchLiveScores } from "./live-scores";
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
  const limit = sport === "NCAAF" || sport === "NFL" ? 4.25 : 3.25;
  return ageH >= limit;
}

export function dropFinishedGames(snap: DeskSnapshot): DeskSnapshot {
  const done = new Set(snap.quotes.filter(isFinishedQuote).map((q) => q.eventId));
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
  if (!scores.length) return snap;
  const liveN = scores.filter((s) => s.inPlay).length;
  return {
    ...snap,
    quotes: applyLiveScores(snap.quotes, scores),
    sourceNote: liveN
      ? `${snap.sourceNote} Live scores: ${liveN} in play.`
      : snap.sourceNote,
  };
}
