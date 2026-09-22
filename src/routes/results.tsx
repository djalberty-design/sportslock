import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { useState, useEffect } from "react";
import { History, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const getGradedResultsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql`
      SELECT sport, type, market_type as market, selection, home, away, model_probability as model_prob, edge, status, graded_at, snapped_at
      FROM market_tape
      WHERE status IN ('WIN', 'LOSS')
      ORDER BY graded_at DESC
      LIMIT 500
    `;
    return { ok: true, rows };
  });

export const Route = createFileRoute("/results")({
  component: ResultsPage,
});

function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGradedResultsFn()
      .then((res) => {
        if (res.ok && res.rows) setResults(res.rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute stats
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  let w7 = 0, l7 = 0;
  let w30 = 0, l30 = 0;
  let wSeason = 0, lSeason = 0;

  const bySport: Record<string, { w: number, l: number }> = {};

  for (const r of results) {
    const isWin = r.status === "WIN";
    const gradedAt = new Date(r.graded_at);
    const daysOld = (now.getTime() - gradedAt.getTime()) / dayMs;

    if (isWin) wSeason++; else lSeason++;
    
    if (daysOld <= 7) {
      if (isWin) w7++; else l7++;
    }
    if (daysOld <= 30) {
      if (isWin) w30++; else l30++;
    }

    const s = r.sport || "Other";
    if (!bySport[s]) bySport[s] = { w: 0, l: 0 };
    if (isWin) bySport[s].w++; else bySport[s].l++;
  }

  const p7 = w7 + l7 > 0 ? (w7 / (w7 + l7) * 100).toFixed(1) : "0.0";
  const p30 = w30 + l30 > 0 ? (w30 / (w30 + l30) * 100).toFixed(1) : "0.0";
  const pSeason = wSeason + lSeason > 0 ? (wSeason / (wSeason + lSeason) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          Track Record <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 tracking-normal uppercase">Verified</span>
        </h1>
        <p className="text-sm text-muted">A fully transparent history of the AI's graded predictions.</p>
      </div>

      {loading ? (
        <div className="text-center p-10 text-muted">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          Loading track record...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary Card */}
          <div className="bg-panel border border-line rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-line">
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] uppercase tracking-wider text-muted mb-1">7-Day</span>
              <span className="text-2xl font-mono font-bold text-ink">{w7}-{l7}</span>
              <span className="text-sm font-bold text-primary">{p7}%</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] uppercase tracking-wider text-muted mb-1">30-Day</span>
              <span className="text-2xl font-mono font-bold text-ink">{w30}-{l30}</span>
              <span className="text-sm font-bold text-primary">{p30}%</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] uppercase tracking-wider text-muted mb-1">Season</span>
              <span className="text-2xl font-mono font-bold text-ink">{wSeason}-{lSeason}</span>
              <span className="text-sm font-bold text-primary">{pSeason}%</span>
            </div>
          </div>

          {/* By Sport Breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(bySport).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).map(([sport, rec]) => (
              <div key={sport} className="bg-obsidian border border-line rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs font-bold text-muted">{sport}</span>
                <span className="text-sm font-mono text-ink">{rec.w}-{rec.l}</span>
              </div>
            ))}
          </div>

          {/* Results List */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Recent Picks</h2>
            {results.map((r, i) => (
              <div key={i} className="bg-panel border border-line rounded-lg p-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="shrink-0">
                    {r.status === "WIN" ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : (
                      <XCircle className="size-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-ink truncate">
                      {r.selection}
                    </span>
                    <span className="text-xs text-muted truncate">
                      {r.away} @ {r.home}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-obsidian border border-line px-1.5 rounded text-muted">{r.sport}</span>
                      <span className="text-[10px] text-muted">{r.market}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs font-mono font-bold text-primary">{Math.round((r.model_prob || 0) * 100)}% AI</span>
                  {r.graded_at && <span className="text-[10px] text-muted">{new Date(r.graded_at).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
            {results.length === 0 && (
              <div className="text-center p-8 text-muted border border-dashed border-line rounded-xl">
                No graded results found yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
