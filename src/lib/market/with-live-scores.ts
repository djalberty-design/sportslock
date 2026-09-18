import { buildLiveSnapshot } from "./live-board";
import { applyLiveScores, fetchLiveScores } from "./live-scores";
import type { DeskSnapshot } from "./types";

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
