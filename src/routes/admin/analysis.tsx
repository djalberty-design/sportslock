import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAnalysisDataFn, batchGradeFn } from "@/lib/market/server";
import { cn } from "@/lib/utils";
import {
  Brain, BarChart2, Filter, RefreshCw, Download, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Target, AlertTriangle, Zap, CheckCircle2, XCircle, Clock, Info,
  Search, ShieldAlert, Check, X
} from "lucide-react";

export const Route = createFileRoute("/admin/analysis")({ component: AnalysisWorkbench });

type Filters = {
  sport: string;
  marketType: string;
  status: string;
  bucket: string;
  dateFrom: string;
  dateTo: string;
  edgeTier: string;
  page: number;
};

const INITIAL_FILTERS: Filters = {
  sport: "", marketType: "", status: "", bucket: "", dateFrom: "", dateTo: "", edgeTier: "", page: 1,
};

function AnalysisWorkbench() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["analysis-data", filters],
    queryFn: () => getAnalysisDataFn({ data: filters }),
    refetchInterval: 60_000,
  });

  const gradeMut = useMutation({
    mutationFn: () => batchGradeFn(),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["analysis-data"] });
      const snappedMsg = result.snapped ? `Snapped ${result.snapped} new board predictions. ` : "";
      const gradeMsg = `Graded ${result.graded || 0} predictions (${result.historical || 0} from historical). ${result.expired || 0} expired.`;
      const noteMsg = (result.graded === 0 && !result.snapped) ? "\n\nAll completed games are up-to-date and graded. Remaining pending predictions are upcoming games." : "";
      alert(`${snappedMsg}${gradeMsg}${noteMsg}`);
    },
  });

  const d = data as any;
  const agg = d?.aggregates || {};
  const cal = d?.calibration || [];
  const rows = d?.rows || [];
  const sportBreak = d?.sportBreakdown || [];
  const marketBreak = d?.marketBreakdown || [];
  const autopsy = d?.autopsyBreakdown || {
    model_miss: 0,
    echoed_book: 0,
    high_variance: 0,
    settled: 0,
  };

  const setFilter = (key: keyof Filters, value: string | number) => {
    setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? (value as number) : 1 }));
  };

  const totalAutopsied = (autopsy.model_miss || 0) + (autopsy.echoed_book || 0) + (autopsy.high_variance || 0) + (autopsy.settled || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-sm text-emerald-500 flex items-center gap-1.5">
            <BarChart2 className="size-4" /> ANALYSIS WORKBENCH
          </p>
          <h1 className="font-display text-3xl text-ink mt-1">Deep-Dive Analysis & Loss Forensics</h1>
          <p className="text-sm text-muted mt-1">
            Filter, slice, and audit every prediction the brain has ever made. Inspect calibration drift and root-cause loss autopsies.
          </p>
        </div>

        {/* Admin Actions Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => gradeMut.mutate()}
            disabled={gradeMut.isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", gradeMut.isPending && "animate-spin")} />
            {gradeMut.isPending ? "Grading..." : "Grade All Pending"}
          </button>
          <Tooltip text="Fetches historical ESPN scores for every past date with ungraded predictions. Grades ML, spread, and total. Marks predictions >14 days old as expired." />
        </div>
      </header>

      {/* ── SECTION: FORENSIC 4-BUCKET LOSS AUTOPSY MATRIX ── */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader
            icon={<Brain className="size-4 text-emerald-400" />}
            title="Forensic 4-Bucket Loss Autopsy Matrix"
            description="The Brain investigates every decided pick and classifies losses into 4 root-cause categories. Click any card to filter the prediction table below."
          />
          {filters.bucket && (
            <button
              onClick={() => setFilter("bucket", "")}
              className="text-xs text-primary font-bold hover:underline shrink-0"
            >
              Clear Bucket Filter ({filters.bucket.replace(/_/g, " ")}) ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <AutopsyCard
            title="Model Miss"
            bucket="model_miss"
            active={filters.bucket === "model_miss"}
            count={autopsy.model_miss || 0}
            total={totalAutopsied}
            color="border-red-500/50 bg-red-500/10 text-red-400"
            badgeColor="bg-red-500/20 text-red-400"
            tag="Overconfidence"
            description="Model assigned high probability/edge to a side that lost convincingly. Trigger for chance haircuts and feature tuning."
            onClick={() => setFilter("bucket", filters.bucket === "model_miss" ? "" : "model_miss")}
          />
          <AutopsyCard
            title="Echoed Book"
            bucket="echoed_book"
            active={filters.bucket === "echoed_book"}
            count={autopsy.echoed_book || 0}
            total={totalAutopsied}
            color="border-amber-500/50 bg-amber-500/10 text-amber-400"
            badgeColor="bg-amber-500/20 text-amber-400"
            tag="Market Trap"
            description="Model followed consensus lines into public traps without detecting asymmetric sharp book resistance. Zero true alpha."
            onClick={() => setFilter("bucket", filters.bucket === "echoed_book" ? "" : "echoed_book")}
          />
          <AutopsyCard
            title="High Variance"
            bucket="high_variance"
            active={filters.bucket === "high_variance"}
            count={autopsy.high_variance || 0}
            total={totalAutopsied}
            color="border-zinc-500/50 bg-zinc-500/10 text-zinc-300"
            badgeColor="bg-zinc-500/20 text-zinc-300"
            tag="Bad Beat / Coin-Flip"
            description="Loss decided by 1 possession, overtime, or bad-beat garbage time. Model math was sound; variance struck."
            onClick={() => setFilter("bucket", filters.bucket === "high_variance" ? "" : "high_variance")}
          />
          <AutopsyCard
            title="Settled / Alpha Hit"
            bucket="settled"
            active={filters.bucket === "settled"}
            count={autopsy.settled || 0}
            total={totalAutopsied}
            color="border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
            badgeColor="bg-emerald-500/20 text-emerald-400"
            tag="Alpha Confirmed"
            description="Model accurately spotted closing line inefficiency, beat the closing line value (CLV), and generated profit."
            onClick={() => setFilter("bucket", filters.bucket === "settled" ? "" : "settled")}
          />
        </div>
      </section>

      {/* Filters Bar */}
      <div className="bg-panel border border-line rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-ink mb-3">
          <Filter className="size-4" /> Filters & Segmentation
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <FilterSelect label="Sport" value={filters.sport} onChange={(v) => setFilter("sport", v)}
            options={[["", "All Sports"], ["NFL", "NFL"], ["NCAAF", "NCAAF"], ["MLB", "MLB"], ["NBA", "NBA"], ["NHL", "NHL"], ["NCAAB", "NCAAB"]]} />
          <FilterSelect label="Market" value={filters.marketType} onChange={(v) => setFilter("marketType", v)}
            options={[["", "All Markets"], ["ml", "Moneyline"], ["spread", "Spread"], ["total", "Total"], ["prop", "Player Prop"]]} />
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)}
            options={[["", "All Statuses"], ["WIN", "Won ✅"], ["LOSS", "Lost ❌"], ["PUSH", "Push ➡️"], ["PENDING", "Pending ⏳"], ["EXPIRED", "Expired 💀"]]} />
          <FilterSelect label="Autopsy Bucket" value={filters.bucket} onChange={(v) => setFilter("bucket", v)}
            options={[["", "All Buckets"], ["model_miss", "🔴 Model Miss"], ["echoed_book", "🟡 Echoed Book"], ["high_variance", "⚪ High Variance"], ["settled", "🟢 Settled"]]} />
          <FilterSelect label="Edge Tier" value={filters.edgeTier} onChange={(v) => setFilter("edgeTier", v)}
            options={[["", "All Edges"], ["HIGH", "High (≥5%)"], ["LOW", "Low (2-5%)"], ["MICRO", "Micro (<2%)"]]} />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted font-bold">From Date</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-obsidian border border-line rounded text-sm text-ink" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted font-bold">To Date</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-obsidian border border-line rounded text-sm text-ink" />
          </div>
        </div>
        {(filters.sport || filters.marketType || filters.status || filters.bucket || filters.edgeTier || filters.dateFrom || filters.dateTo) && (
          <button onClick={() => setFilters(INITIAL_FILTERS)} className="mt-2.5 text-xs text-primary font-bold hover:underline">
            Reset all filters
          </button>
        )}
      </div>

      {/* Section A: Performance Summary */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <SectionHeader icon={<Target className="size-4" />} title="Performance Summary"
          description="Win/loss counts and key metrics for the current filter. Brier Score measures probabilistic precision (lower = better, 0.25 = coin flip)." />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 mt-4">
          <StatCard label="Total" value={agg.total || 0} color="text-blue-400" />
          <StatCard label="Won" value={agg.wins || 0} color="text-emerald-400" />
          <StatCard label="Lost" value={agg.losses || 0} color="text-red-400" />
          <StatCard label="Push" value={agg.pushes || 0} color="text-zinc-400" />
          <StatCard label="Pending" value={agg.pending || 0} color="text-amber-400" />
          <StatCard label="Expired" value={agg.expired || 0} color="text-zinc-500" />
          <StatCard label="Win Rate" value={`${agg.win_rate || 0}%`}
            color={Number(agg.win_rate) >= 55 ? "text-emerald-400" : Number(agg.win_rate) >= 50 ? "text-amber-400" : "text-red-400"} />
          <StatCard label="Brier Score" value={agg.brier != null ? Number(agg.brier).toFixed(4) : "—"}
            color={Number(agg.brier) < 0.22 ? "text-emerald-400" : Number(agg.brier) < 0.25 ? "text-amber-400" : "text-red-400"} />
          <StatCard label="Avg CLV" value={agg.avg_clv != null ? `${agg.avg_clv > 0 ? "+" : ""}${Number(agg.avg_clv).toFixed(1)}%` : "—"}
            color={Number(agg.avg_clv) > 0 ? "text-emerald-400" : "text-amber-400"} />
        </div>
      </section>

      {/* Section B: Calibration Curve */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <SectionHeader icon={<TrendingUp className="size-4" />} title="Calibration Reliability Curve"
          description="Compares predicted probability to actual empirical hit rate. A 60% prediction hitting 60% of the time represents perfect calibration. Bars reaching dashed lines are calibrated." />
        {cal.length > 0 ? (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[80px_1fr_80px_80px_60px] gap-2 text-[10px] uppercase tracking-wider text-muted font-bold px-2">
              <span>Predicted</span><span>Calibration</span><span>Actual</span><span>Model</span><span>N</span>
            </div>
            {cal.map((b: any) => {
              const predicted = Number(b.avg_prob || 0);
              const actual = Number(b.actual_rate || 0);
              const diff = actual - predicted;
              const isGood = Math.abs(diff) < 0.05;
              return (
                <div key={b.bucket} className="grid grid-cols-[80px_1fr_80px_80px_60px] gap-2 items-center px-2 py-1 rounded hover:bg-line/30">
                  <span className="text-sm font-bold text-ink">{b.bucket * 10}-{b.bucket * 10 + 10}%</span>
                  <div className="relative h-6 bg-line/30 rounded overflow-hidden">
                    {/* Perfect calibration line */}
                    <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-muted/40" style={{ left: `${predicted * 100}%` }} />
                    {/* Actual hit rate bar */}
                    <div className={cn("absolute top-0 bottom-0 rounded", isGood ? "bg-emerald-500/50" : diff > 0 ? "bg-blue-500/50" : "bg-red-500/50")}
                      style={{ width: `${actual * 100}%` }} />
                  </div>
                  <span className={cn("text-sm font-bold", isGood ? "text-emerald-400" : diff > 0 ? "text-blue-400" : "text-red-400")}>
                    {(actual * 100).toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted">{(predicted * 100).toFixed(1)}%</span>
                  <span className="text-sm text-muted">{b.n}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted mt-4">No graded predictions match the current filter.</p>
        )}
      </section>

      {/* Section C: Breakdowns */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<Zap className="size-4" />} title="By Sport"
            description="Win rate breakdown by sport. Shows where the model performs best and worst." />
          <div className="mt-3 space-y-2">
            {sportBreak.map((s: any) => (
              <BreakdownRow key={s.sport} label={s.sport} wins={s.wins} losses={s.losses} />
            ))}
            {!sportBreak.length && <p className="text-sm text-muted">No data</p>}
          </div>
        </section>
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<BarChart2 className="size-4" />} title="By Market Type"
            description="Win rate breakdown by market (ML, Spread, Total). Reveals if the model is stronger on certain bet types." />
          <div className="mt-3 space-y-2">
            {marketBreak.map((m: any) => (
              <BreakdownRow key={m.market_type} label={m.market_type?.toUpperCase()} wins={m.wins} losses={m.losses} />
            ))}
            {!marketBreak.length && <p className="text-sm text-muted">No data</p>}
          </div>
        </section>
      </div>

      {/* Section D: Prediction Table */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader icon={<Brain className="size-4" />} title="Prediction Forensics Table"
            description="Every prediction matching your filters. Click any row to expand root-cause autopsy notes and raw snapshots." />
          {filters.bucket && (
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
              Filtered by: {filters.bucket.replace(/_/g, " ").toUpperCase()}
            </span>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted border-b border-line">
                <th className="text-left py-2 px-2">Selection</th>
                <th className="text-left py-2 px-2 hidden md:table-cell">Matchup</th>
                <th className="text-left py-2 px-2">Market</th>
                <th className="text-right py-2 px-2">Model %</th>
                <th className="text-right py-2 px-2">Edge</th>
                <th className="text-center py-2 px-2">Status</th>
                <th className="text-center py-2 px-2">Autopsy Bucket</th>
                <th className="text-center py-2 px-2 hidden md:table-cell">Score</th>
                <th className="text-right py-2 px-2 hidden lg:table-cell" title="Scheduled game date">Game Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <React.Fragment key={r.id}>
                <tr
                  onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                  className="border-b border-line/50 hover:bg-line/20 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1">
                      {expandedRow === r.id ? <ChevronDown className="size-3 text-muted" /> : <ChevronRight className="size-3 text-muted" />}
                      <span className="font-bold text-ink">{r.selection}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-muted hidden md:table-cell">{r.away} @ {r.home}</td>
                  <td className="py-2 px-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-line text-muted uppercase font-bold">{r.marketType}</span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono">{r.modelProb != null ? `${Math.round(r.modelProb * 100)}%` : "—"}</td>
                  <td className={cn("py-2 px-2 text-right font-mono", Number(r.edge) > 0 ? "text-emerald-400" : "text-red-400")}>
                    {r.edge != null ? `${Number(r.edge) > 0 ? "+" : ""}${Number(r.edge).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2 px-2 text-center">
                    {r.bucket ? (
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", {
                        "bg-red-500/15 text-red-400 border border-red-500/20": r.bucket === "model_miss",
                        "bg-amber-500/15 text-amber-400 border border-amber-500/20": r.bucket === "echoed_book",
                        "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20": r.bucket === "high_variance",
                        "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20": r.bucket === "settled",
                      })}>{r.bucket.replace(/_/g, " ")}</span>
                    ) : <span className="text-muted text-xs">—</span>}
                  </td>
                  <td className="py-2 px-2 text-center hidden md:table-cell font-mono text-muted">
                    {r.resultHome != null ? `${r.resultAway}-${r.resultHome}` : "—"}
                  </td>
                  <td className="py-2 px-2 text-right hidden lg:table-cell">
                    <div className="font-medium text-ink">
                      {r.start
                        ? new Date(r.start).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" })
                        : (r.snappedAt ? new Date(r.snappedAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" }) : "—")}
                    </div>
                  </td>
                </tr>
                {expandedRow === r.id && (
                  <tr className="bg-obsidian/50">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* Column 1: Game Details */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Game Details</div>
                          <div><span className="text-muted">Final Score:</span> <span className="text-ink font-mono">{r.resultHome != null ? `${r.away} ${r.resultAway} — ${r.home} ${r.resultHome}` : "Not yet graded"}</span></div>
                          <div><span className="text-muted">Odds Price:</span> <span className="text-ink font-mono">{r.price != null ? (r.price > 0 ? `+${r.price}` : r.price) : "—"}</span></div>
                          <div><span className="text-muted">Line:</span> <span className="text-ink font-mono">{r.line != null ? r.line : "—"}</span></div>
                          <div><span className="text-muted">Side:</span> <span className="text-ink">{r.side || "—"}</span></div>
                        </div>
                        {/* Column 2: Timing & IDs */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Timing & Identity</div>
                          <div><span className="text-muted">Snapped:</span> <span className="text-ink">{r.snappedAt ? new Date(r.snappedAt).toLocaleString() : "—"}</span></div>
                          <div><span className="text-muted">Game Start:</span> <span className="text-ink">{r.start ? new Date(r.start).toLocaleString() : "—"}</span></div>
                          <div><span className="text-muted">Graded:</span> <span className="text-ink">{r.gradedAt ? new Date(r.gradedAt).toLocaleString() : "Not graded"}</span></div>
                        </div>
                        {/* Column 3: AI Autopsy */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">AI Autopsy Assessment</div>
                          <div><span className="text-muted">Bucket:</span>{" "}
                            {r.bucket ? (
                              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", {
                                "bg-red-500/15 text-red-400": r.bucket === "model_miss",
                                "bg-amber-500/15 text-amber-400": r.bucket === "echoed_book",
                                "bg-zinc-500/15 text-zinc-400": r.bucket === "high_variance",
                                "bg-emerald-500/15 text-emerald-400": r.bucket === "settled",
                              })}>{r.bucket.replace(/_/g, " ")}</span>
                            ) : <span className="text-muted">—</span>}
                          </div>
                          {r.autopsyNote && (
                            <div className="bg-line/20 rounded p-2 text-ink/80 italic leading-relaxed">{r.autopsyNote}</div>
                          )}
                        </div>
                      </div>
                      {/* Snapshot JSON */}
                      {r.snapshot && (
                        <details className="mt-3">
                          <summary className="text-[10px] uppercase tracking-wider text-muted font-bold cursor-pointer hover:text-ink">
                            Engine Snapshot (Raw JSON) ▸
                          </summary>
                          <pre className="mt-1 p-2 bg-zinc-950 border border-line rounded text-[10px] text-muted font-mono max-h-48 overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(r.snapshot, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
              {!rows.length && (
                <tr><td colSpan={9} className="py-8 text-center text-muted">No predictions match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {(agg.total || 0) > 50 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
            <span className="text-sm text-muted">
              Showing {(filters.page - 1) * 50 + 1}-{Math.min(filters.page * 50, agg.total)} of {agg.total}
            </span>
            <div className="flex gap-2">
              <button disabled={filters.page <= 1} onClick={() => setFilter("page", filters.page - 1)}
                className="px-3 py-1 text-sm bg-line rounded hover:bg-line/70 disabled:opacity-50">Prev</button>
              <button disabled={filters.page * 50 >= (agg.total || 0)} onClick={() => setFilter("page", filters.page + 1)}
                className="px-3 py-1 text-sm bg-line rounded hover:bg-line/70 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Components ──

function AutopsyCard({
  title, bucket, active, count, total, color, badgeColor, tag, description, onClick
}: {
  title: string;
  bucket: string;
  active: boolean;
  count: number;
  total: number;
  color: string;
  badgeColor: string;
  tag: string;
  description: string;
  onClick: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group",
        active ? `${color} ring-2 ring-primary shadow-lg` : "bg-obsidian border-line hover:border-primary/40"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-sm font-bold text-ink group-hover:text-primary transition-colors">{title}</span>
          <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase", badgeColor)}>
            {tag}
          </span>
        </div>
        <p className="text-[10px] text-muted leading-relaxed line-clamp-3">{description}</p>
      </div>

      <div className="pt-2 border-t border-line/40 flex items-center justify-between">
        <span className="text-xl font-display font-bold text-ink">
          {count} <span className="text-xs text-muted font-normal">({pct}%)</span>
        </span>
        <span className="text-[10px] font-mono font-bold text-primary">
          {active ? "Active Filter ✕" : "Filter ▸"}
        </span>
      </div>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="relative group inline-flex items-center">
      <Info className="size-4 text-muted cursor-help" />
      <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-obsidian border border-line rounded-lg text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        {text}
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

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-obsidian border border-line rounded-lg p-3 text-center">
      <div className={cn("text-xl font-display font-bold", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase() || "PENDING";
  if (s === "WIN") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold"><CheckCircle2 className="size-3" />WIN</span>;
  if (s === "LOSS") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-bold"><XCircle className="size-3" />LOSS</span>;
  if (s === "PUSH") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-500/15 text-zinc-400 text-[10px] font-bold">PUSH</span>;
  if (s === "EXPIRED") return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-500 text-[10px] font-bold">EXPIRED</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold"><Clock className="size-3" />PENDING</span>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted font-bold">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 px-2 py-1.5 bg-obsidian border border-line rounded text-sm text-ink">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function BreakdownRow({ label, wins, losses }: { label: string; wins: number; losses: number }) {
  const total = wins + losses;
  const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-bold text-ink w-20">{label}</span>
      <div className="flex-1 h-5 bg-line/30 rounded overflow-hidden flex">
        <div className="bg-emerald-500/60 h-full" style={{ width: `${wr}%` }} />
        <div className="bg-red-500/40 h-full" style={{ width: `${100 - wr}%` }} />
      </div>
      <span className="text-xs text-muted w-24 text-right">{wins}/{total} · {wr}%</span>
    </div>
  );
}
