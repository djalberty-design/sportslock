import { boardFreshness } from "./board-freshness.ts";

export type BoardSource = "stored" | "compute";

export function pickBoardSource(input: {
  storedAsOf?: string | null;
  quotaAction?: "fetch" | "serve_stale";
  forceCompute?: boolean;
  now?: number;
}): BoardSource {
  if (input.forceCompute) return "compute";
  if (!input.storedAsOf) return "compute";
  if (input.quotaAction === "serve_stale") return "stored";
  const fresh = boardFreshness(input.storedAsOf, input.now);
  if (fresh.kind === "paused") return "compute";
  return "stored";
}
