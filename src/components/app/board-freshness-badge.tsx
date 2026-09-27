import { boardFreshness } from "@/lib/market/board-freshness";
import { useDeskDecision } from "@/lib/market/use-board";
import { cn } from "@/lib/utils";

export function BoardFreshnessBadge() {
  const { snapshot } = useDeskDecision();
  const fresh = boardFreshness(snapshot?.asOf ?? null);
  const tone =
    fresh.kind === "fresh"
      ? "text-emerald-400"
      : fresh.kind === "aging"
        ? "text-amber-400"
        : "text-red-400";
  return (
    <span className={cn("normal-case tracking-normal font-mono truncate max-w-[46vw] sm:max-w-none", tone)} title={snapshot?.sourceNote || fresh.badge}>
      {fresh.badge}
    </span>
  );
}
