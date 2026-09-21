import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrainStatsFn, batchGradeFn, getLatestAnalysisFn, runAnalysisFn } from "@/lib/market/server";
import { cn } from "@/lib/utils";
import {
  Brain, Activity, Target, TrendingUp, TrendingDown, Eye, Zap,
  RefreshCw, AlertTriangle, CheckCircle2, Info, BarChart2, Flame, Server
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({ component: Dashboard });

function Dashboard() {
  const qc = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["brain-stats"],
    queryFn: () => getBrainStatsFn(),
    refetchInterval: 30_000,
  });

  const gradeMut = useMutation({
    mutationFn: () => batchGradeFn(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["brain-stats"] });
      qc.invalidateQueries({ queryKey: ["latest-analysis"] });
      alert(`Graded ${result.graded} predictions (${result.historical || 0} historical). ${result.expired || 0} marked expired.`);
    },
  });

  const { data: analysisData } = useQuery({
    queryKey: ["latest-analysis"],
    queryFn: () => getLatestAnalysisFn(),
    refetchInterval: 120_000,
  });

  const analysisMut = useMutation({
    mutationFn: () => runAnalysisFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["latest-analysis"] }),
  });

  const analysis = analysisData?.data as any;

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-emerald-500">🧠 DASHBOARD</p>
          <h1 className="font-display text-3xl text-ink mt-1">Brain Status</h1>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-panel border border-line rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const decided = stats.wins + stats.losses;
  const wr = decided > 0 ? Math.round((stats.wins / decided) * 100) : 0;
  const hasPending = stats.pending > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <p className="text-sm text-emerald-500 flex items-center gap-1.5">
          <Brain className="size-4" /> OVERSEER DASHBOARD
        </p>
        <h1 className="font-display text-3xl text-ink mt-1">Brain Status</h1>
        <p className="text-sm text-muted mt-1">
          Everything at a glance — is the brain working correctly? See prediction performance, data source health, and system status.
        </p>
      </header>

      {/* Pending Alert */}
      {hasPending && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <AlertTriangle className="size-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-400">{stats.pending} predictions waiting to be graded</p>
            <p className="text-xs text-muted mt-0.5">
              These predictions haven't been matched to a final score yet. Click "Grade Now" to fetch historical scores and grade them all.
            </p>
          </div>
          <button
            onClick={() => gradeMut.mutate()}
            disabled={gradeMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 text-sm font-bold rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={cn("size-4", gradeMut.isPending && "animate-spin")} />
            {gradeMut.isPending ? "Grading..." : "Grade Now"}
          </button>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <HeroStat icon={<Activity className="size-5" />} label="Total Predictions" value={stats.total}
          color="text-blue-400" tooltip="Every recommended prediction the brain has ever made" />
        <HeroStat icon={<Target className="size-5" />} label="Win Rate" value={`${wr}%`}
          color={wr >= 55 ? "text-emerald-400" : wr >= 50 ? "text-amber-400" : "text-red-400"}
          tooltip="Percentage of graded predictions that were correct. 55%+ is strong." />
        <HeroStat icon={<TrendingUp className="size-5" />} label="Wins" value={stats.wins} color="text-emerald-400"
          tooltip="Predictions where the model's recommended side won" />
        <HeroStat icon={<TrendingDown className="size-5" />} label="Losses" value={stats.losses} color="text-red-400"
          tooltip="Predictions where the model's recommended side lost" />
        <HeroStat icon={<Eye className="size-5" />} label="Pending" value={stats.pending} color="text-amber-400"
          tooltip="Predictions not yet graded — need final scores. Use 'Grade Now' to process them." />
      </div>

      {/* Daily Digest + Rolling Record */}
      {(stats as any).dailyDigest && (() => {
        const d = (stats as any).dailyDigest;
        const todayDecided = d.todayWins + d.todayLosses;
        return (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Today's Summary */}
            <section className="bg-panel border border-line rounded-xl p-4">
              <SectionHeader icon={<Flame />} title="Today's Summary"
                description="Graded picks from today's completed games." />
              <div className="mt-3">
                {todayDecided > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-display font-bold text-ink">{d.todayWins}-{d.todayLosses}</span>
                      <span className={cn("text-sm font-bold", d.todayWins > d.todayLosses ? "text-emerald-400" : d.todayWins < d.todayLosses ? "text-red-400" : "text-muted")}>
                        ({Math.round(d.todayWins / todayDecided * 100)}%)
                      </span>
                    </div>
                    {d.bestHit && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-400 font-bold">🎯 Best Hit</span>
                        <span className="text-muted">{d.bestHit.sport} · {d.bestHit.selection} · {d.bestHit.home} vs {d.bestHit.away}</span>
                      </div>
                    )}
                    {d.worstMiss && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400 font-bold">❌ Worst Miss</span>
                        <span className="text-muted">{d.worstMiss.sport} · {d.worstMiss.selection} · {d.worstMiss.home} vs {d.worstMiss.away}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No graded picks yet today.</p>
                )}
              </div>
            </section>

            {/* Rolling Record */}
            <section className="bg-panel border border-line rounded-xl p-4">
              <SectionHeader icon={<BarChart2 />} title="Rolling Record"
                description="Win rate over different time windows." />
              <div className="mt-3 space-y-2">
                {[
                  { label: "7 Day", ...d.week },
                  { label: "30 Day", ...d.month },
                  { label: "All Time", ...d.allTime },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted font-medium">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-ink font-bold">{row.wins}-{row.losses}</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                        row.pct >= 55 ? "bg-emerald-500/20 text-emerald-400" :
                        row.pct >= 52 ? "bg-amber-500/20 text-amber-400" :
                        row.pct > 0 ? "bg-red-500/20 text-red-400" : "bg-line text-muted"
                      )}>
                        {row.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      })()}

      {/* Quick Performance Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Win Rate Gauge */}
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<Target />} title="Brain Accuracy"
            description="How accurate is the model? 50% = random, 52.4% = break even after vig, 55%+ = strong edge." />
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 h-8 bg-line/30 rounded-full overflow-hidden relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted/50" title="50% = random" />
              <div className="absolute top-0 bottom-0 w-px border-l border-dashed border-amber-400/60" style={{ left: "52.4%" }} title="52.4% = break even" />
              <div className={cn("h-full rounded-full transition-all", wr >= 55 ? "bg-emerald-500" : wr >= 52 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${Math.min(wr, 100)}%` }} />
            </div>
            <span className={cn("text-2xl font-display font-bold", wr >= 55 ? "text-emerald-400" : wr >= 52 ? "text-amber-400" : "text-red-400")}>
              {wr}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1 px-1 relative">
            <span>0%</span><span>50% (random)</span><span className="absolute text-amber-400/70" style={{ left: "52.4%" }}>52.4%</span><span>100%</span>
          </div>
        </section>

        {/* Data Health */}
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<Server />} title="System Health"
            description="Status of data sources feeding the brain. All should show green for full prediction accuracy." />
          <div className="mt-4 space-y-2">
            <HealthRow label="Historical Score Grading" status="active"
              detail="Grades past-day predictions via ESPN historical API" />
            <HealthRow label="Live Score Feed" status="active"
              detail="ESPN + MLB scoreboards for today's games" />
            <HealthRow label="Odds API" status="active"
              detail="Lines, odds, and player props from The Odds API" />
            <HealthRow label="Calibration Engine" status="active"
              detail="Brier scoring, reliability tables, precision haircuts" />
            <HealthRow label="Suggestions Engine" status="active"
              detail="Auto-detects miscalibration and proposes adjustments" />
          </div>
        </section>
      </div>

      {/* Self-Improvement Status */}
      <section className="bg-panel border border-line rounded-xl p-4">
        <SectionHeader icon={<Zap />} title="Self-Improvement Loop"
          description="After every grading sweep, the brain analyzes its own performance. Calibration drift tells you if the model is getting better or worse. Edge profitability tells you if the model's 'edges' actually make money." />
        
        <div className="mt-4 flex items-center gap-3 mb-4">
          <button onClick={() => analysisMut.mutate()} disabled={analysisMut.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50">
            <RefreshCw className={cn("size-3", analysisMut.isPending && "animate-spin")} />
            {analysisMut.isPending ? "Analyzing..." : "Run Analysis Now"}
          </button>
          {analysisData?.lastRun && (
            <span className="text-[10px] text-muted">Last run: {new Date(analysisData.lastRun).toLocaleString()}</span>
          )}
        </div>

        {analysis ? (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Calibration Drift */}
            <div className="bg-obsidian border border-line rounded-lg p-3">
              <div className="text-xs font-bold text-muted uppercase mb-2">Calibration Drift</div>
              {analysis.calibrationDrift ? (
                <>
                  <div className={cn("text-lg font-display font-bold",
                    analysis.calibrationDrift.direction === "improving" ? "text-emerald-400" :
                    analysis.calibrationDrift.direction === "worsening" ? "text-red-400" : "text-amber-400"
                  )}>
                    {analysis.calibrationDrift.direction === "improving" ? "📈 Improving" :
                     analysis.calibrationDrift.direction === "worsening" ? "📉 Drifting" : "➡️ Stable"}
                  </div>
                  <p className="text-[10px] text-muted mt-1">
                    Recent Brier: {Number(analysis.calibrationDrift.recentBrier).toFixed(4)} vs Overall: {Number(analysis.calibrationDrift.overallBrier).toFixed(4)}
                  </p>
                </>
              ) : <p className="text-xs text-muted italic">Need more graded data</p>}
            </div>

            {/* Edge Profitability */}
            <div className="bg-obsidian border border-line rounded-lg p-3">
              <div className="text-xs font-bold text-muted uppercase mb-2">Edge Profitability</div>
              {(analysis.edgeProfitability || []).length > 0 ? (
                <div className="space-y-1">
                  {(analysis.edgeProfitability || []).map((e: any) => (
                    <div key={e.tier} className="flex items-center justify-between text-xs">
                      <span className="text-ink">{e.tier}</span>
                      <span className={cn("font-bold", e.profitable ? "text-emerald-400" : "text-red-400")}>
                        {e.winRate}% ({e.wins}/{e.n})
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted italic">Need more graded data</p>}
            </div>

            {/* Top Segments */}
            <div className="bg-obsidian border border-line rounded-lg p-3">
              <div className="text-xs font-bold text-muted uppercase mb-2">Best Segments</div>
              {(analysis.segmentBrier || []).slice(0, 4).map((s: any) => (
                <div key={`${s.sport}-${s.marketType}`} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-ink">{s.sport} {s.marketType?.toUpperCase()}</span>
                  <span className={cn("font-bold", s.beatBaseline ? "text-emerald-400" : "text-red-400")}>
                    {s.beatBaseline ? "✓ Beating book" : "✗ Book wins"}
                  </span>
                </div>
              ))}
              {!(analysis.segmentBrier || []).length && <p className="text-xs text-muted italic">Need more graded data</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted italic">No analysis data yet. Click "Run Analysis Now" or wait for the next grading sweep.</p>
        )}
      </section>

      {/* What Each Tab Does */}
      <section className="bg-panel border border-line rounded-xl p-4">
        <SectionHeader icon={<Info />} title="Overseer Tab Guide"
          description="Quick reference for what each tab does and when to use it." />
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <TabGuide emoji="🧠" name="Dashboard" route="/admin/dashboard"
            desc="You are here. Overall brain health, accuracy, and system status." />
          <TabGuide emoji="📊" name="Analysis Workbench" route="/admin/analysis"
            desc="Deep-dive into predictions. Filter by sport/market/date. Calibration curve shows where the model is right vs wrong." />
          <TabGuide emoji="⚙️" name="Engine Controls" route="/admin/engine"
            desc="Tune the brain. Review and apply suggestions. Adjust Kelly %, min edge, max legs. See what accepted changes are active." />
          <TabGuide emoji="🔐" name="Approvals" route="/admin/approvals"
            desc="Manage user sign-ups. Approve or deny new accounts." />
        </div>
      </section>
    </div>
  );
}

// ── Components ──

function HeroStat({ icon, label, value, color, tooltip }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; tooltip: string;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4 relative group">
      <div className={cn("text-2xl font-display font-bold", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1 flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-obsidian border border-line rounded-lg text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-center">
        {tooltip}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold text-ink">{icon} {title}</div>
      <p className="text-xs text-muted mt-1">{description}</p>
    </div>
  );
}

function HealthRow({ label, status, detail }: { label: string; status: "active" | "idle" | "error"; detail: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <CheckCircle2 className={cn("size-4 shrink-0", status === "active" ? "text-emerald-400" : status === "idle" ? "text-amber-400" : "text-red-400")} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-ink">{label}</span>
        <p className="text-[10px] text-muted truncate">{detail}</p>
      </div>
      <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded",
        status === "active" ? "bg-emerald-500/10 text-emerald-400" :
        status === "idle" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
      )}>{status}</span>
    </div>
  );
}

function TabGuide({ emoji, name, route, desc }: { emoji: string; name: string; route: string; desc: string }) {
  return (
    <div className="bg-obsidian border border-line rounded-lg p-3">
      <div className="text-sm font-bold text-ink">{emoji} {name}</div>
      <p className="text-[10px] text-muted mt-1">{desc}</p>
    </div>
  );
}
