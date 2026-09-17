import { useDeskStore } from "@/lib/desk-store";
import { cn } from "@/lib/utils";

export type BetType = "all" | "single" | "combo2" | "combo3" | "combo4";

const BETS: { id: BetType; label: string }[] = [
  { id: "all", label: "All Picks" },
  { id: "single", label: "Single Games" },
  { id: "combo2", label: "2-Pick Combos" },
  { id: "combo3", label: "3-Pick Combos" },
  { id: "combo4", label: "4-Pick Combos" },
];

export function MasterFilter({
  betType,
  onBetType,
  sameGameOnly,
  onSameGameOnly,
  propsIncluded,
  onPropsIncluded,
}: {
  betType: BetType;
  onBetType: (t: BetType) => void;
  sameGameOnly: boolean;
  onSameGameOnly: (v: boolean) => void;
  propsIncluded: boolean;
  onPropsIncluded: (v: boolean) => void;
}) {
  const hideCollege = useDeskStore((s) => s.hideCollege);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bet type">
        {BETS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={betType === b.id}
            onClick={() => onBetType(b.id)}
            className={cn(
              "min-h-11 rounded-md px-4 text-sm font-medium",
              betType === b.id ? "bg-emerald-500 text-zinc-950" : "bg-wash text-muted hover:text-ink",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSameGameOnly(!sameGameOnly)}
          className={cn(
            "min-h-11 rounded-md px-4 text-sm font-medium",
            sameGameOnly ? "bg-wash-gold text-emerald-500" : "bg-wash text-muted hover:text-ink",
          )}
        >
          Same-Game Only
        </button>
        <button
          type="button"
          onClick={() => onPropsIncluded(!propsIncluded)}
          className={cn(
            "min-h-11 rounded-md px-4 text-sm font-medium",
            propsIncluded ? "bg-wash-gold text-emerald-500" : "bg-wash text-muted hover:text-ink",
          )}
        >
          Player Props Included
        </button>
        {hideCollege ? (
          <p className="self-center text-xs text-muted">College player bets stay blocked in Florida.</p>
        ) : null}
      </div>
    </div>
  );
}
