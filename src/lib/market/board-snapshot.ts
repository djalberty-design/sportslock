import { createServerFn } from "@tanstack/react-start";
import { dropFinishedGames, snapshotWithLiveScores } from "./with-live-scores";
import type { DeskSnapshot } from "./types";

export const getLiveBoardSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<DeskSnapshot> => {
  try {
    const snap = await snapshotWithLiveScores();
    return dropFinishedGames(snap);
  } catch (err: any) {
    console.error("LIVE_SNAPSHOT_ERROR:", err);
    return {
      asOf: new Date().toISOString(),
      delayed: false,
      sample: false,
      hours: { preGameOpen: false, etStamp: 0, etDate: "", nextLock: null, label: "ERROR", note: `CRASH IN SNAPSHOT: ${String(err.stack || err)}` },
      quotes: [],
      news: [],
      publicSplits: [],
      briefs: [],
      predict: [],
      sourceNote: "FATAL SERVER ERROR: " + (err?.stack || err?.message || String(err)),
    } as DeskSnapshot;
  }
});
