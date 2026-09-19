import { cn } from "@/lib/utils";

/* ─── Projected Score ─── */
export function ProjectedScore({
  homeAbbr,
  awayAbbr,
  homePf,
  homePa,
  awayPf,
  awayPa,
  total,
  homeSpread,
  className,
}: {
  homeAbbr?: string;
  awayAbbr?: string;
  homePf?: number;
  homePa?: number;
  awayPf?: number;
  awayPa?: number;
  total?: number;
  homeSpread?: number;
  className?: string;
}) {
  // Derive projected score from available data
  let projHome: number | null = null;
  let projAway: number | null = null;

  if (total != null && homeSpread != null) {
    // Best method: total + spread → exact projected score
    // homeSpread is negative if home is favored
    projHome = Math.round(((total - homeSpread) / 2) * 10) / 10;
    projAway = Math.round(((total + homeSpread) / 2) * 10) / 10;
  } else if (homePf != null && awayPf != null) {
    // Fallback: season averages
    projHome = Math.round(((homePf + awayPa!) / 2) * 10) / 10;
    projAway = Math.round(((awayPf + homePa!) / 2) * 10) / 10;
  }

  if (projHome == null || projAway == null) return null;

  const homeWins = projHome > projAway;
  const margin = Math.abs(projHome - projAway);

  return (
    <div className={cn("flex items-center gap-4 rounded-lg border border-line bg-panel/50 px-4 py-2.5", className)}>
      <div className="flex-1 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted font-bold">{awayAbbr || "AWAY"}</p>
        <p className={cn("font-mono text-2xl font-bold tabular-nums", !homeWins ? "text-emerald-400" : "text-ink")}>{projAway.toFixed(1)}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] uppercase tracking-widest text-muted">Projected</span>
        <span className="text-[10px] text-primary font-bold">
          {homeWins ? homeAbbr : awayAbbr} by {margin.toFixed(1)}
        </span>
      </div>
      <div className="flex-1 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted font-bold">{homeAbbr || "HOME"}</p>
        <p className={cn("font-mono text-2xl font-bold tabular-nums", homeWins ? "text-emerald-400" : "text-ink")}>{projHome.toFixed(1)}</p>
      </div>
    </div>
  );
}

/* ─── Public vs Sharp Split Meter ─── */
export function PublicSharpMeter({
  ticketPct,
  handlePct,
  home,
  away,
  className,
}: {
  ticketPct?: number;
  handlePct?: number;
  home?: string;
  away?: string;
  className?: string;
}) {
  if (ticketPct == null || handlePct == null) return null;

  // ticketPct = % of tickets on home, handlePct = % of money on home
  const publicSide = ticketPct > 50 ? (home || "Home") : (away || "Away");
  const sharpSide = handlePct > 50 ? (home || "Home") : (away || "Away");
  const split = publicSide !== sharpSide;

  return (
    <div className={cn("rounded-lg border border-line bg-panel/50 p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted font-bold">Public vs Sharp Money</span>
        {split && (
          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full ring-1 ring-amber-500/20">
            SPLIT ACTION
          </span>
        )}
      </div>

      {/* Public (ticket count) */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted">🎟️ Public bets</span>
          <span className="text-ink font-bold">{Math.round(ticketPct)}% {home}</span>
        </div>
        <div className="h-2 rounded-full bg-obsidian overflow-hidden flex">
          <div
            className="h-full rounded-l-full bg-blue-500 transition-all"
            style={{ width: `${100 - ticketPct}%` }}
          />
          <div
            className="h-full rounded-r-full bg-orange-500 transition-all"
            style={{ width: `${ticketPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted mt-0.5">
          <span>{away} {Math.round(100 - ticketPct)}%</span>
          <span>{home} {Math.round(ticketPct)}%</span>
        </div>
      </div>

      {/* Sharp (handle / money) */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted">💰 Sharp money</span>
          <span className="text-ink font-bold">{Math.round(handlePct)}% {home}</span>
        </div>
        <div className="h-2 rounded-full bg-obsidian overflow-hidden flex">
          <div
            className="h-full rounded-l-full bg-blue-500 transition-all"
            style={{ width: `${100 - handlePct}%` }}
          />
          <div
            className="h-full rounded-r-full bg-emerald-500 transition-all"
            style={{ width: `${handlePct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted mt-0.5">
          <span>{away} {Math.round(100 - handlePct)}%</span>
          <span>{home} {Math.round(handlePct)}%</span>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-muted leading-tight">
        {split
          ? `⚡ Pros and casual bettors disagree. Sharp money (${sharpSide}) often predicts the winner more accurately.`
          : `Both public and sharp money lean the same way (${publicSide}).`}
      </p>
    </div>
  );
}

/* ─── CLV Badge ─── */
export function ClvBadge({
  clv,
  className,
}: {
  clv?: number;
  className?: string;
}) {
  if (clv == null || clv === 0) return null;

  const positive = clv > 0;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
      positive
        ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
        : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
      className,
    )}>
      CLV {positive ? "+" : ""}{clv}
    </span>
  );
}

/* ─── Streak Badge ─── */
export function StreakBadge({
  form,
  teamName,
  className,
}: {
  form?: Array<{ team: string; results: string[] }>;
  teamName?: string;
  className?: string;
}) {
  if (!form || !teamName) return null;

  const teamForm = form.find(
    (f) => f.team.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(f.team.toLowerCase())
  );
  if (!teamForm?.results?.length) return null;

  // Count current streak from most recent
  let streak = 0;
  const dir = teamForm.results[0];
  for (const r of teamForm.results) {
    if (r === dir) streak++;
    else break;
  }

  if (streak < 2) return null;

  const isWin = dir.toUpperCase().startsWith("W");

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
      isWin
        ? "bg-emerald-500/15 text-emerald-400"
        : "bg-red-500/15 text-red-400",
      className,
    )}>
      {isWin ? "🔥" : "❄️"} {streak}{isWin ? "W" : "L"}
    </span>
  );
}
