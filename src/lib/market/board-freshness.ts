export type FreshnessKind = "fresh" | "aging" | "stale" | "paused";

export type Freshness = {
  kind: FreshnessKind;
  ageSeconds: number;
  badge: string;
};

export function boardFreshness(asOfIso: string | null | undefined, now = Date.now()): Freshness {
  if (!asOfIso) {
    return { kind: "paused", ageSeconds: Number.POSITIVE_INFINITY, badge: "Board age unknown — paused" };
  }
  const t = new Date(asOfIso).getTime();
  if (!Number.isFinite(t)) {
    return { kind: "paused", ageSeconds: Number.POSITIVE_INFINITY, badge: "Board age unknown — paused" };
  }
  const ageSeconds = Math.max(0, Math.round((now - t) / 1000));
  if (ageSeconds < 30 * 60) return { kind: "fresh", ageSeconds, badge: "Board live" };
  if (ageSeconds < 6 * 60 * 60) return { kind: "aging", ageSeconds, badge: "Board aging" };
  if (ageSeconds < 24 * 60 * 60) return { kind: "stale", ageSeconds, badge: "Serving last valid board" };
  return { kind: "paused", ageSeconds, badge: "Quota paused — last valid board" };
}
