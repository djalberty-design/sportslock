import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBrainStatsFn, type BrainStats } from "@/lib/market/server";
import { cn } from "@/lib/utils";
import { Brain, TrendingUp, TrendingDown, Activity, Target, AlertTriangle, Zap, BarChart2, Flame, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/brain-intel")({ component: BrainIntel });

function BrainIntel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["brain-stats"],
    queryFn: () => getBrainStatsFn(),
    refetchInterval: 60_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-emerald-500">ADMIN</p>
          <h1 className="font-display text-3xl text-ink mt-1">Brain Intelligence</h1>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-panel border border-line rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const decided = stats.wins + stats.losses;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <p className="text-sm text-emerald-500 flex items-center gap-1.5">
          <Brain className="size-4" /> THE BRAIN
        </p>
        <h1 className="font-display text-3xl text-ink mt-1">Intelligence Dashboard</h1>
        <p className="text-sm text-muted mt-1">Self-improving prediction engine — every prediction tracked, graded, and analyzed.</p>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Predictions" value={stats.total} icon={<Activity className="size-5" />} color="text-blue-400" />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={<Target className="size-5" />}
          color={stats.winRate >= 55 ? "text-emerald-400" : stats.winRate >= 50 ? "text-amber-400" : "text-red-400"} />
        <StatCard label="Wins" value={stats.wins} icon={<TrendingUp className="size-5" />} color="text-emerald-400" />
        <StatCard label="Losses" value={stats.losses} icon={<TrendingDown className="size-5" />} color="text-red-400" />
        <StatCard label="Pending" value={stats.pending} icon={<Eye className="size-5" />} color="text-amber-400" />
      </div>

      {/* Streak & Autopsy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Streak */}
        <div className="bg-panel border border-line rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
            <Flame className="size-3.5 text-amber-500" /> Streak Tracker
          </h3>
          <div className="flex items-end gap-6">
            <div>
              <div className={cn("text-4xl font-mono font-black", stats.streakData.streakType === "WIN" ? "text-emerald-400" : stats.streakData.streakType === "LOSS" ? "text-red-400" : "text-muted")}>
                {stats.streakData.currentStreak}
              </div>
              <div className="text-xs text-muted mt-1">
                Current {stats.streakData.streakType === "WIN" ? "🔥 Win" : stats.streakData.streakType === "LOSS" ? "❄️ Loss" : ""} Streak
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-emerald-400 font-mono font-bold">{stats.streakData.longestWin}</div>
                <div className="text-[10px] text-muted">Best Win Run</div>
              </div>
              <div>
                <div className="text-red-400 font-mono font-bold">{stats.streakData.longestLoss}</div>
                <div className="text-[10px] text-muted">Worst Loss Run</div>
              </div>
            </div>
          </div>
        </div>

        {/* Autopsy Report */}
        <div className="bg-panel border border-line rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" /> Loss Autopsy
          </h3>
          <div className="space-y-3">
            <AutopsyRow label="High Variance (Bad Luck)" count={stats.autopsySummary.highVariance} total={stats.losses} color="text-amber-400 bg-amber-500" />
            <AutopsyRow label="Model Error (Brain Issue)" count={stats.autopsySummary.modelError} total={stats.losses} color="text-red-400 bg-red-500" />
            <AutopsyRow label="Unreviewed" count={stats.autopsySummary.unreviewed} total={stats.losses} color="text-zinc-400 bg-zinc-500" />
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* By Market Type */}
        <BreakdownCard title="By Market Type" icon={<BarChart2 className="size-3.5" />} data={stats.byMarket.map(m => ({
          label: m.market.toUpperCase(), value: `${m.winRate}%`, sub: `${m.wins}/${m.total}`, pct: m.winRate
        }))} />

        {/* By Sport */}
        <BreakdownCard title="By Sport" icon={<Zap className="size-3.5" />} data={stats.bySport.map(s => ({
          label: s.sport.toUpperCase(), value: `${s.winRate}%`, sub: `${s.wins}/${s.total}`, pct: s.winRate
        }))} />

        {/* By Edge Tier */}
        <BreakdownCard title="By Edge Tier" icon={<Target className="size-3.5" />} data={stats.byEdgeTier.map(e => ({
          label: e.tier, value: `${e.winRate}%`, sub: `${e.wins}/${e.total}`, pct: e.winRate
        }))} />
      </div>

      {/* Recent Prediction Log */}
      <div className="bg-panel border border-line rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-1.5">
          <Eye className="size-3.5 text-primary" /> Recent Predictions (Last 50)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-muted text-left">
                <th className="py-2 px-2 font-bold">Selection</th>
                <th className="py-2 px-2 font-bold">Market</th>
                <th className="py-2 px-2 font-bold">AI Prob</th>
                <th className="py-2 px-2 font-bold">Edge</th>
                <th className="py-2 px-2 font-bold">Status</th>
                <th className="py-2 px-2 font-bold hidden md:table-cell">Autopsy</th>
                <th className="py-2 px-2 font-bold">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLogs.map((log) => (
                <tr key={log.id} className="border-b border-line/50 hover:bg-wash/50">
                  <td className="py-2 px-2 font-medium text-ink max-w-[200px] truncate">{log.selection}</td>
                  <td className="py-2 px-2 text-muted uppercase">{log.marketType}</td>
                  <td className="py-2 px-2 font-mono text-primary">{Math.round(log.modelProb * 100)}%</td>
                  <td className={cn("py-2 px-2 font-mono", log.edge > 0 ? "text-emerald-400" : "text-red-400")}>
                    {log.edge > 0 ? "+" : ""}{(log.edge * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold",
                      log.status === "WIN" ? "bg-emerald-500/20 text-emerald-400" :
                      log.status === "LOSS" ? "bg-red-500/20 text-red-400" :
                      log.status === "PUSH" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    )}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-muted hidden md:table-cell max-w-[200px] truncate">
                    {log.autopsy ? (log.autopsy.includes("HIGH VARIANCE") ? "🎲 Variance" : "⚠️ Model Error") : "—"}
                  </td>
                  <td className="py-2 px-2 text-muted whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
              {stats.recentLogs.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted">No predictions logged yet. The sweep cron runs hourly.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable components ---------- */

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4 flex flex-col gap-2">
      <div className={cn("size-8 rounded-lg flex items-center justify-center bg-current/10", color)}>
        {icon}
      </div>
      <div className={cn("text-2xl md:text-3xl font-mono font-black", color)}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function AutopsyRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const [textColor, barColor] = color.split(" ");
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className={cn("font-mono font-bold", textColor)}>{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-line/30 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BreakdownCard({ title, icon, data }: { title: string; icon: React.ReactNode; data: { label: string; value: string; sub: string; pct: number }[] }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {data.length === 0 && <p className="text-sm text-muted">No graded data yet.</p>}
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.label}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs font-bold text-ink">{d.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted font-mono">{d.sub}</span>
                <span className={cn("text-xs font-mono font-bold", d.pct >= 55 ? "text-emerald-400" : d.pct >= 50 ? "text-amber-400" : "text-red-400")}>
                  {d.value}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-line/30 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                d.pct >= 55 ? "bg-emerald-500" : d.pct >= 50 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${d.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
