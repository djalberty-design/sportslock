import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Filter,
  Zap,
  TrendingUp,
  ShieldCheck,
  Download,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
  Lock,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculatePortfolioStats,
  exportAuditLedger,
  computeClv,
  type ClvRecord,
} from "@/lib/clv-tracker";
import { formatAmerican } from "@/lib/market/hit-pct";

export const getGradedResultsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql`
      SELECT id, sport, market_type as market, selection, home, away, price, close_price, model_probability as model_prob, edge, status, graded_at, snapped_at, line, result_home, result_away
      FROM (
        SELECT DISTINCT ON (COALESCE(event_id, home || '|' || away), market_type)
          id, sport, market_type, selection, home, away, price, close_price, model_probability, edge, status, graded_at, snapped_at, line, result_home, result_away
        FROM market_tape
        WHERE status IN ('WIN', 'LOSS')
          AND (recommended = true OR (recommended IS NULL AND edge > 0))
        ORDER BY COALESCE(event_id, home || '|' || away), market_type, recommended DESC NULLS LAST, edge DESC NULLS LAST, model_probability DESC, graded_at DESC
      ) sub
      ORDER BY graded_at DESC
      LIMIT 500
    `;
    const mapped = (rows as any[]).map((r) => ({
      id: String(r.id || ""),
      sport: String(r.sport || ""),
      market: String(r.market || ""),
      selection: String(r.selection || ""),
      home: String(r.home || ""),
      away: String(r.away || ""),
      price: r.price != null ? Number(r.price) : null,
      model_prob: r.model_prob != null ? Number(r.model_prob) : null,
      edge: r.edge != null ? Number(r.edge) : null,
      status: String(r.status || ""),
      graded_at: r.graded_at ? String(r.graded_at) : null,
      snapped_at: r.snapped_at ? String(r.snapped_at) : null,
      line: r.line != null ? Number(r.line) : null,
      close_price: r.close_price != null ? Number(r.close_price) : null,
      result_home: r.result_home != null ? Number(r.result_home) : null,
      result_away: r.result_away != null ? Number(r.result_away) : null,
    }));
    return { ok: true, rows: mapped };
  });

export const Route = createFileRoute("/results")({
  component: ResultsPage,
});

function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [copiedAudit, setCopiedAudit] = useState(false);

  useEffect(() => {
    getGradedResultsFn()
      .then((res) => {
        if (res.ok && res.rows) setResults(res.rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const clvRecords: ClvRecord[] = useMemo(() => {
    return results.flatMap((r, i) => {
      const betPrice = r.price;
      const closingPrice = r.close_price;
      if (betPrice == null || closingPrice == null) return [];
      return [{
        id: r.id || `TICK-${i + 1}`,
        selection: r.selection,
        sport: r.sport,
        market: r.market,
        betPrice,
        closingPrice,
        fairProb: r.model_prob ?? undefined,
        hit: r.status === "WIN",
        status: r.status,
        timestamp: r.graded_at || r.snapped_at || undefined,
      }];
    });
  }, [results]);

  const { stats, curve } = useMemo(() => calculatePortfolioStats(clvRecords), [clvRecords]);

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  let w7 = 0, l7 = 0, w30 = 0, l30 = 0, wSeason = 0, lSeason = 0;
  const bySport: Record<string, { w: number; l: number }> = {};
  for (const r of results) {
    const isWin = r.status === "WIN";
    const gradedAt = new Date(r.graded_at);
    const daysOld = (now.getTime() - gradedAt.getTime()) / dayMs;
    if (isWin) wSeason++; else lSeason++;
    if (daysOld <= 7) { if (isWin) w7++; else l7++; }
    if (daysOld <= 30) { if (isWin) w30++; else l30++; }
    const s = r.sport || "Other";
    if (!bySport[s]) bySport[s] = { w: 0, l: 0 };
    if (isWin) bySport[s].w++; else bySport[s].l++;
  }
  const pSeason = wSeason + lSeason > 0 ? ((wSeason / (wSeason + lSeason)) * 100).toFixed(1) : "0.0";
  const filtered = selectedSport === "ALL" ? results : results.filter((r) => r.sport === selectedSport);

  const handleExport = (format: "csv" | "json") => {
    const content = exportAuditLedger(clvRecords, format);
    const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sportslock_audit_ledger_${new Date().toISOString().slice(0, 10)}.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(stats.auditHash);
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 2000);
  };

  const svgWidth = 600;
  const svgHeight = 160;
  const padX = 40;
  const padY = 25;
  const plotWidth = svgWidth - padX * 2;
  const plotHeight = svgHeight - padY * 2;
  const minUnits = Math.min(0, ...curve.map((p) => p.cumulativeUnits));
  const maxUnits = Math.max(10, stats.highWaterMarkUnits + 2, ...curve.map((p) => p.cumulativeUnits));
  const unitsSpan = maxUnits - minUnits || 1;
  const points = useMemo(() => {
    if (curve.length === 0) return [];
    return curve.map((pt, i) => {
      const x = padX + (i / Math.max(1, curve.length - 1)) * plotWidth;
      const y = svgHeight - padY - ((pt.cumulativeUnits - minUnits) / unitsSpan) * plotHeight;
      return { ...pt, x, y };
    });
  }, [curve, minUnits, unitsSpan, padX, padY, plotWidth, plotHeight]);
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, "");
  }, [points]);
  const zeroY = svgHeight - padY - ((0 - minUnits) / unitsSpan) * plotHeight;
  const hwmY = svgHeight - padY - ((stats.highWaterMarkUnits - minUnits) / unitsSpan) * plotHeight;

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase font-bold flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Cryptographically Audited
            </span>
            <button type="button" onClick={handleCopyHash} className="text-[10px] font-mono text-muted hover:text-ink bg-panel border border-line px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
              <Lock className="size-3 text-primary" />
              <span>{stats.auditHash}</span>
              {copiedAudit && <span className="text-emerald-400 font-bold">Copied!</span>}
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-ink">Track Record</h1>
          <p className="text-xs sm:text-sm text-muted max-w-2xl mt-0.5">CLV uses a stored close_price when one exists. We do not invent a close from edge.</p>
          <p className="text-xs text-muted max-w-2xl mt-1">This is the public model calibration tape. Your personal locked tickets live on <Link to="/ticket" search={{ id: "" }} className="text-primary underline-offset-2 hover:underline">Ticket</Link>.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => handleExport("csv")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold font-mono bg-panel border border-line text-ink hover:border-primary/50 transition-colors">
            <FileSpreadsheet className="size-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button type="button" onClick={() => handleExport("json")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold font-mono bg-panel border border-line text-ink hover:border-primary/50 transition-colors">
            <Download className="size-3.5 text-primary" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-center p-12 text-muted">Loading ledger…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Win Rate</span>
              <span className="text-xl font-mono font-bold text-emerald-400">{pSeason}%</span>
              <span className="text-[10px] text-muted font-mono block">{wSeason}-{lSeason}</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Cumulative P&L</span>
              <span className="text-xl font-mono font-bold text-primary">{stats.cumulativeUnits >= 0 ? `+${stats.cumulativeUnits}u` : `${stats.cumulativeUnits}u`}</span>
              <span className="text-[10px] text-muted font-mono block">Units, 1u = one standard flat bet</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">BTCL Rate</span>
              <span className="text-xl font-mono font-bold text-emerald-400">{stats.btclRate}%</span>
              <span className="text-[10px] text-muted font-mono block">Share of picks that beat the last real close</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Average CLV</span>
              <span className="text-xl font-mono font-bold text-amber-400">{stats.averageClvPct >= 0 ? `+${stats.averageClvPct}%` : `${stats.averageClvPct}%`}</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Max Drawdown</span>
              <span className="text-xl font-mono font-bold text-red-400">{stats.maxDrawdownUnits}u</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Brier Score</span>
              <span className="text-xl font-mono font-bold text-purple-400">{stats.brierScore}</span>
            </div>
          </div>
          <div className="bg-panel border border-line rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h3 className="text-sm font-bold text-ink font-display">Cumulative units</h3>
            </div>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
              <line x1={padX} y1={zeroY} x2={svgWidth - padX} y2={zeroY} stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 2" />
              <line x1={padX} y1={hwmY} x2={svgWidth - padX} y2={hwmY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
              {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedSport("ALL")} className={cn("border rounded-lg px-3 py-1.5 text-xs font-bold", selectedSport === "ALL" ? "bg-primary text-black border-primary" : "bg-obsidian border-line text-muted")}>
              All Sports ({results.length})
            </button>
            {Object.entries(bySport).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).map(([sport, rec]) => (
              <button key={sport} type="button" onClick={() => setSelectedSport(sport)} className={cn("border rounded-lg px-3 py-1.5 text-xs", selectedSport === sport ? "bg-primary text-black border-primary" : "bg-obsidian border-line text-muted")}>
                {sport} {rec.w}-{rec.l}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {filtered.map((r, i) => {
              const isWin = r.status === "WIN";
              const clv = r.price != null && r.close_price != null ? computeClv(r.price, r.close_price) : null;
              return (
                <div key={r.id || i} className={cn("border rounded-xl p-3.5 flex items-center justify-between gap-4", isWin ? "border-emerald-500/30" : "border-line/60")}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{r.selection}</p>
                    <p className="text-xs text-muted truncate">{r.away} @ {r.home}</p>
                    <p className="text-[10px] font-mono text-muted mt-1">{clv == null ? "CLV \u2014" : `${clv.beatTheClosingLine ? "BTCL" : "CLV"} ${clv.clvPct}% (${clv.clvCents}c)`}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {isWin ? <CheckCircle2 className="size-5 text-emerald-400 ml-auto" /> : <XCircle className="size-5 text-red-400 ml-auto" />}
                    <p className="text-[10px] text-muted mt-1">{formatAmerican(r.price)}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-muted">No graded results for {selectedSport}.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
