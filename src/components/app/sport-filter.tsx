import { sportLabel } from "@/lib/copy";
import { useDeskStore } from "@/lib/desk-store";
import { ALL_SPORTS } from "@/lib/market/universe";
import { cn } from "@/lib/utils";

const ORDER = [...ALL_SPORTS];

export function SportFilter({ sports }: { sports: string[] }) {
  const value = useDeskStore((s) => s.sportFilter);
  const set = useDeskStore((s) => s.setSportFilter);
  const live = new Set(sports);
  const extras = sports.filter((s) => !ORDER.includes(s as (typeof ORDER)[number]));
  const options = ["ALL", ...ORDER, ...extras];

  return (
    <div className="flex flex-wrap gap-2 pb-1" role="tablist" aria-label="Filter by sport">
      {options.map((s) => {
        const active = value === s || (s === "ALL" && (!value || value === "ALL"));
        const soon = s !== "ALL" && !live.has(s);
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => set(s)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm font-medium",
              active ? "bg-neon text-obsidian" : "bg-panel text-muted hover:text-ink",
            )}
          >
            {s === "ALL" ? "All" : s === "NCAAF" ? "College Football" : s === "NCAAB" ? "College Basketball" : s}
            {soon ? <span className="ml-1 text-xs uppercase tracking-wide opacity-70">soon</span> : null}
            <span className="sr-only">{s === "ALL" ? "All sports" : sportLabel(s)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function applySportFilter<T extends { sport: string }>(rows: T[], sportFilter: string | undefined): T[] {
  if (!sportFilter || sportFilter === "ALL") return rows;
  return rows.filter((r) => r.sport === sportFilter);
}

export function SportSeasonNote({ sport }: { sport: string }) {
  const copy: Record<string, string> = {
    NBA: "NBA preseason typically tips in early October. When ESPN lists the games they show here — even before a number is posted. Photograph a Hard Rock Bet Florida ticket anytime and we grade it the same way as football.",
    NHL: "NHL preseason typically starts mid-September. Games stay on this board once ESPN lists them. Photograph the book when the number drops.",
    NCAAB: "College basketball opens in early November. Team bets (who wins, spread, over/under) are allowed in Florida. College player bets are not. Photograph a ticket anytime.",
    NCAAF: "College football is on the board through the fall. Team bets only for player stats — no college athlete props in Florida.",
    MLB: "MLB posts most days in season. If tonight is empty, the slate may be off or already final.",
    NFL: "NFL Sundays, plus Monday and Thursday nights. Photograph the Hard Rock number before you confirm.",
  };
  return (
    <p className="rounded-md bg-panel px-4 py-3 text-sm text-ink/80">
      {copy[sport] ?? "No games in this filter yet. Photograph a ticket and we will still grade it."}
    </p>
  );
}
