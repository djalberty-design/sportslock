import { createServerFn } from "@tanstack/react-start";
import { dropFinishedGames, snapshotWithLiveScores } from "./with-live-scores";
import { boardFreshness } from "./board-freshness";
import { readOddsApiCache } from "./odds-api";
import type { DeskSnapshot } from "./types";

export const getLiveBoardSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<DeskSnapshot> => {
  try {
    // Force a compute so a thin same-day snapshot cannot hide today's ESPN slate.
    const snap = await snapshotWithLiveScores(new Date().toISOString());
    const cleaned = dropFinishedGames(snap);
    const cached = await readOddsApiCache("mains");
    const fresh = boardFreshness(cached?.fetchedAt?.toISOString() ?? cleaned.asOf);
    return {
      ...cleaned,
      delayed: fresh.kind !== "fresh",
      sourceNote: `${cleaned.sourceNote} ${fresh.badge}.`.trim(),
    };
  } catch (err: any) {
    console.error("LIVE_SNAPSHOT_ERROR:", err);
    return {
      asOf: new Date().toISOString(),
      delayed: true,
      sample: false,
      hours: { preGameOpen: false, etStamp: "", etDate: "", nextLock: null, label: "ERROR", note: `CRASH IN SNAPSHOT: ${String(err.stack || err)}` },
      quotes: [],
      news: [],
      publicSplits: [],
      briefs: [],
      predict: [],
      sourceNote: "FATAL SERVER ERROR: " + (err?.stack || err?.message || String(err)),
    } as DeskSnapshot;
  }
});
