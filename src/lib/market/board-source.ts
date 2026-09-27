import { boardFreshness } from "./board-freshness.ts";
import { etDayKey, nowEtDayKey } from "./slate-day.ts";

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
  const nowDate = input.now != null ? new Date(input.now) : new Date();
  const storedDay = etDayKey(input.storedAsOf);
  const today = nowEtDayKey(nowDate);
  if (storedDay && storedDay < today) return "compute";
  const fresh = boardFreshness(input.storedAsOf, input.now);
  if (fresh.kind === "paused") return "compute";
  return "stored";
}
