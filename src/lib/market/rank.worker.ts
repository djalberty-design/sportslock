/// <reference lib="webworker" />
import { runRankJob, type RankRequest } from "./rank.ts";

self.onmessage = async (e: MessageEvent<RankRequest>) => {
  try {
    self.postMessage(await runRankJob(e.data));
  } catch (err) {
    self.postMessage({
      id: e.data?.id ?? 0,
      error: err instanceof Error ? err.message : "Ranking failed",
    });
  }
};
