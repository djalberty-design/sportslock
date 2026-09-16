import { liveFromRow } from "@/lib/market/live-state";
import { cn } from "@/lib/utils";

export type Liveish = {
  eventId?: string;
  sport?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  inPlay?: boolean;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  clock?: string;
  statusText?: string;
  situation?: string;
  leftover?: boolean;
};

export function isLiveRow(row?: Liveish | null): boolean {
  return Boolean(row?.inPlay);
}

function stateOf(row?: Liveish | null) {
  if (!row?.inPlay || !row.eventId || !row.sport) return null;
  return liveFromRow({
    eventId: row.eventId,
    sport: row.sport,
    inPlay: true,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    period: row.period,
    clock: row.clock,
    situation: row.situation,
  });
}

function scoreClock(row?: Liveish | null): string {
  if (!row) return "";
  const score =
    row.awayScore != null && row.homeScore != null ? `${row.awayScore}–${row.homeScore}` : "";
  const clock = [row.period ? `P${row.period}` : "", row.clock ?? ""].filter(Boolean).join(" ");
  return [score, clock].filter(Boolean).join(" · ");
}

export function LiveStamp({ row, className }: { row?: Liveish | null; className?: string }) {
  if (!row?.inPlay) return null;
  
  let stateStr = "";
  if (row.sport === "MLB" && row.statusText) {
    stateStr = row.statusText.toUpperCase();
  } else {
    let p = row.period != null ? String(row.period) : "";
    if (p && (row.sport === "NFL" || row.sport === "NCAAF" || row.sport === "NBA")) {
      p = "Q" + p;
    } else if (p && row.sport === "MLB") {
      p = "Inning " + p;
    } else if (p) {
      p = "P" + p;
    }
    const clk = row.clock ?? "";
    stateStr = [p, clk].filter(Boolean).join(" ");
  }
  
  const score = row.homeScore != null && row.awayScore != null ? " | " + (row.awayAbbr || "AWAY") + " " + row.awayScore + " - " + (row.homeAbbr || "HOME") + " " + row.homeScore : "";

  return (
    <span className={cn("stamp flex items-center gap-2 text-red-600 dark:text-red-400 font-bold", className)}>
      <span className="animate-pulse h-2 w-2 rounded-full bg-red-600 dark:bg-red-500"></span>
      LIVE {stateStr}{score}
    </span>
  );
}

export function LiveBanner({ row }: { row?: Liveish | null }) {
  if (!row?.inPlay) return null;
  const s = stateOf(row);
  const extra = scoreClock(row);
  return (
    <p className="rounded-md bg-wash-gold px-3 py-2 text-sm text-gold">
      Live. Remaining-G from the current score and clock. Never The Call.
      {extra ? ` ${extra}.` : " Score not posted yet."}
      {s?.thin ? " Critical field missing (down / outs / strength) — thin look." : ""}
    </p>
  );
}





