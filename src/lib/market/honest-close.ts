/** Last observed book price on the same market after the lock. Never derived from edge. */
export type TapePrint = {
  eventId: string;
  marketType: string;
  side?: string | null;
  snappedAt: string;
  price: number | null;
};

function keyOf(row: Pick<TapePrint, "eventId" | "marketType" | "side">): string {
  return `${row.eventId}|${row.marketType}|${row.side ?? ""}`;
}

export function lastSeenClose(lock: TapePrint, prints: TapePrint[]): number | null {
  if (lock.price == null) return null;
  const key = keyOf(lock);
  const lockTs = Date.parse(lock.snappedAt);
  const later = prints
    .filter((p) => keyOf(p) === key && p.price != null && Number.isFinite(p.price))
    .filter((p) => {
      const t = Date.parse(p.snappedAt);
      return Number.isFinite(t) && Number.isFinite(lockTs) && t >= lockTs;
    })
    .sort((a, b) => Date.parse(b.snappedAt) - Date.parse(a.snappedAt));
  return later[0]?.price ?? null;
}
