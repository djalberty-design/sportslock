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
import { americanToDecimal } from "@/lib/market/book-price";

export const getGradedResultsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    const [rows, careerRows] = await Promise.all([
    sql`
      SELECT id, sport, market_type as market, selection, home, away, price, close_price, model_probability as model_prob, edge, status, graded_at, snapped_at, line, result_home, result_away
      FROM (
        SELECT DISTINCT ON (COALESCE(event_id, home || '|' || away || '|' || COALESCE(snapped_at::date::text, graded_at::date::text, '')), market_type)
          id, sport, market_type, selection, home, away, price, close_price, model_probability, edge, status, graded_at, snapped_at, line, result_home, result_away
        FROM market_tape
        WHERE status IN ('WIN', 'LOSS')
          AND (recommended = true OR (recommended IS NULL AND edge > 0))
        ORDER BY COALESCE(event_id, home || '|' || away || '|' || COALESCE(snapped_at::date::text, graded_at::date::text, '')), market_type, recommended DESC NULLS LAST, edge DESC NULLS LAST, model_probability DESC, graded_at DESC
      ) sub
      ORDER BY graded_at DESC
      LIMIT 500
    `,
    sql`
        SELECT
          count(*)::int as total_graded,
          count(*) FILTER (WHERE status = 'WIN')::int as total_wins,
          count(*) FILTER (WHERE status = 'LOSS')::int as total_losses,
          round(coalesce(sum(
            CASE
              WHEN status = 'WIN' AND price IS NOT NULL AND price > 0 THEN (price::numeric / 100.0)
              WHEN status = 'WIN' AND price IS NOT NULL AND price < 0 THEN (100.0 / abs(price)::numeric)
              WHEN status = 'LOSS' AND price IS NOT NULL THEN -1.0
              ELSE 0
            END
          ), 0)::numeric, 2) as career_units
        FROM (
          SELECT DISTINCT ON (COALESCE(event_id, home || '|' || away || '|' || COALESCE(snapped_at::date::text, graded_at::date::text, '')), market_type)
            price, status
          FROM market_tape
          WHERE status IN ('WIN', 'LOSS')
            AND (recommended = true OR (recommended IS NULL AND edge > 0))
          ORDER BY COALESCE(event_id, home || '|' || away || '|' || COALESCE(snapped_at::date::text, graded_at::date::text, '')), market_type, recommended DESC NULLS LAST, edge DESC NULLS LAST, model_probability DESC, graded_at DESC
        ) sub
      `,
    ]);
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
    const rawCareer = (careerRows as any[])[0] || {};
    const career = {
      totalGraded: Number(rawCareer.total_graded) || 0,
      totalWins: Number(rawCareer.total_wins) || 0,
      totalLosses: Number(rawCareer.total_losses) || 0,
      careerUnits: Number(rawCareer.career_units) || 0,
    };
    return { ok: true, rows: mapped, career };
  });

export const Route = createFileRoute("/results")({
  component: ResultsPage,
});

function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [career, setCareer] = useState({ totalGraded: 0, totalWins: 0, totalLosses: 0, careerUnits: 0 });
  const [selectedSport, setSelectedSport] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [copiedAudit, setCopiedAudit] = useState(false);

  useEffect(() => {
    getGradedResultsFn()
      .then((res) => {
        if (res.ok && res.rows) setResults(res.rows);
        if (res.ok && (res as any).career) setCareer((res as any).career);
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

  const { stats } = useMemo(() => calculatePortfolioStats(clvRecords), [clvRecords]);

  const pageCurve = useMemo(() => {
    const priced = [...results]
      .filter((r) => r.price != null && Number.isFinite(Number(r.price)))
      .sort((a, b) => new Date(a.graded_at || a.snapped_at || 0).getTime() - new Date(b.graded_at || b.snapped_at || 0).getTime());
    let run = 0;
    let peak = 0;
    return priced.map((r) => {
      const price = Number(r.price);
      const dec = americanToDecimal(price);
      const add = r.status === "WIN" && Number.isFinite(dec) ? Math.round((dec - 1) * 100) / 100 : r.status === "LOSS" ? -1 : 0;
      run = Math.round((run + add) * 100) / 100;
      if (run > peak) peak = run;
      return { cumulativeUnits: run, highWaterMark: peak };
    });
  }, [results]);
  const curve = pageCurve;
  const pageUnits = pageCurve.length ? pageCurve[pageCurve.length - 1].cumulativeUnits : 0;
  const pagePeak = pageCurve.reduce((m, p) => Math.max(m, p.highWaterMark), 0);

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
  const maxUnits = Math.max(1, pagePeak + 2, ...curve.map((p) => p.cumulativeUnits));
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
  const hwmY = svgHeight - padY - ((pagePeak - minUnits) / unitsSpan) * plotHeight;

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase font-bold flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Public log
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Career graded</span>
              <span className="text-xl font-mono font-bold text-ink">{career.totalGraded}</span>
              <span className="text-[10px] text-muted font-mono block">All-time settled recommended picks</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Career record</span>
              <span className="text-xl font-mono font-bold text-ink">{career.totalWins}–{career.totalLosses}</span>
              <span className="text-[10px] text-muted font-mono block">Wins–losses, grows past 500</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Career units</span>
              <span className={`text-xl font-mono font-bold ${career.careerUnits < 0 ? "text-red-400" : career.careerUnits > 0 ? "text-emerald-400" : "text-ink"}`}>{career.careerUnits >= 0 ? `+${career.careerUnits}` : career.careerUnits}u</span>
              <span className="text-[10px] text-muted font-mono block">Units, not dollars. 1u = one standard bet</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">This page</span>
              <span className="text-xl font-mono font-bold text-ink">{results.length}</span>
              <span className="text-[10px] text-muted font-mono block">Latest 500 graded picks</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Win rate</span>
              <span className="text-xl font-mono font-bold text-ink">{pSeason}%</span>
              <span className="text-[10px] text-muted font-mono block">{wSeason}–{lSeason} on this page (latest 500)</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Page P&L</span>
              <span className={`text-xl font-mono font-bold ${pageUnits < 0 ? "text-red-400" : pageUnits > 0 ? "text-emerald-400" : "text-ink"}`}>{pageUnits >= 0 ? `+${pageUnits}` : pageUnits}u</span>
              <span className="text-[10px] text-muted font-mono block">Flat 1u on this page. Units, not dollars</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Beat the close</span>
              <span className="text-xl font-mono font-bold text-ink">{stats.btclRate}%</span>
              <span className="text-[10px] text-muted font-mono block">Based on {stats.totalBets} picks with a stored close</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Vs the last close</span>
              <span className="text-xl font-mono font-bold text-ink">{stats.averageClvPct >= 0 ? `+${stats.averageClvPct}%` : `${stats.averageClvPct}%`}</span>
              <span className="text-[10px] text-muted font-mono block">Based on {stats.totalBets} picks with a stored close</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Worst drop</span>
              <span className="text-xl font-mono font-bold text-red-400">{stats.maxDrawdownUnits}u</span>
            </div>
            <div className="bg-panel border border-line rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-mono block">Forecast error (Brier)</span>
              <span className="text-xl font-mono font-bold text-ink">{stats.brierScore}</span>
              <span className="text-[10px] text-muted font-mono block">0.25 is a coin flip. Lower is better</span>
            </div>
          </div>
          <div className="bg-panel border border-line rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h3 className="text-sm font-bold text-ink font-display">Cumulative units</h3>
            </div>
            <p className="text-[11px] text-muted">Latest 500 graded picks. Career totals are above. 1 unit = your standard bet size.</p>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
              <text x="8" y={zeroY + 3} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">0u break-even</text>
              <text x="8" y={Math.min(svgHeight - 8, (svgHeight - padY) + 3)} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">{`${Math.round(minUnits)}u`}</text>
              <text x={svgWidth - padX} y={Math.max(12, hwmY - 4)} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace" textAnchor="end">Peak</text>
              <line x1={padX} y1={zeroY} x2={svgWidth - padX} y2={zeroY} stroke="#71717a" strokeWidth="1" strokeDasharray="2 2" />
              <line x1={padX} y1={hwmY} x2={svgWidth - padX} y2={hwmY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
              {pathD && <path d={pathD} fill="none" stroke={pageUnits > 0 ? "#10b981" : pageUnits < 0 ? "#ef4444" : "#71717a"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
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
                    <p className="text-[10px] font-mono text-muted mt-1">{clv == null ? "vs close \u2014" : `${clv.beatTheClosingLine ? "beat close" : "vs close"} ${clv.clvPct}%`}</p>
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
