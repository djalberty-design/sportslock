import type { Play } from "@/lib/market/types";
import { sportLabel } from "@/lib/copy";

export function EventWhen({ play }: { play: Play }) {
  if (play.legs?.length) {
    return (
      <div className="mt-3 space-y-2 rounded-md bg-wash px-3 py-3">
        {play.legs.map((leg, i) => (
          <div key={`${leg.selection}-${i}`} className={i ? "border-t border-line pt-2" : ""}>
            <p className="stamp text-emerald-500">
              {sportLabel(leg.sport)} · Game {i + 1}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{leg.selection}</p>
            <p className="text-sm text-ink">
              Away: {leg.away || "—"} · Home: {leg.home || "—"}
            </p>
            <p className="text-sm text-emerald-500">{leg.kickoffEnglish || "Time TBA"}</p>
          </div>
        ))}
      </div>
    );
  }
  if (!play.home && !play.away && !play.kickoffEnglish && !play.sport) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-wash px-3 py-3 text-sm">
      <div className="col-span-2">
        <dt className="text-faint">League</dt>
        <dd className="font-medium text-emerald-500">{sportLabel(play.sport ?? "")}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-faint">When</dt>
        <dd className="font-medium text-emerald-500">{play.kickoffEnglish || "Time TBA"}</dd>
      </div>
      <div>
        <dt className="text-faint">Away</dt>
        <dd className="font-medium text-ink">{play.away || "—"}</dd>
      </div>
      <div>
        <dt className="text-faint">Home</dt>
        <dd className="font-medium text-ink">{play.home || "—"}</dd>
      </div>
    </dl>
  );
}