import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Filter, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export const getGradedResultsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    // Select ONLY the AI model's top recommended prediction / favorite for each market
    // Deduplicates so each game market has exactly ONE prediction (no opposing sides)
    const rows = await sql`
      SELECT sport, market_type as market, selection, home, away, model_probability as model_prob, edge, status, graded_at, snapped_at, line, result_home, result_away
      FROM (
        SELECT DISTINCT ON (COALESCE(event_id, home || '|' || away), market_type)
          sport, market_type, selection, home, away, model_probability, edge, status, graded_at, snapped_at, line, result_home, result_away
        FROM market_tape
        WHERE status IN ('WIN', 'LOSS')
          AND (recommended = true OR (recommended IS NULL AND (model_probability >= 0.50 OR edge > 0)))
        ORDER BY COALESCE(event_id, home || '|' || away), market_type, model_probability DESC, edge DESC NULLS LAST, graded_at DESC
      ) sub
      ORDER BY graded_at DESC
      LIMIT 500
    `;
    const mapped = (rows as any[]).map((r) => ({
      sport: String(r.sport || ""),
      market: String(r.market || ""),
      selection: String(r.selection || ""),
      home: String(r.home || ""),
      away: String(r.away || ""),
      model_prob: r.model_prob != null ? Number(r.model_prob) : null,
      edge: r.edge != null ? Number(r.edge) : null,
      status: String(r.status || ""),
      graded_at: r.graded_at ? String(r.graded_at) : null,
      snapped_at: r.snapped_at ? String(r.snapped_at) : null,
      line: r.line != null ? Number(r.line) : null,
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

  useEffect(() => {
    getGradedResultsFn()
      .then((res) => {
        if (res.ok && res.rows) setResults(res.rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute stats across all recommended picks
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  let w7 = 0, l7 = 0;
  let w30 = 0, l30 = 0;
  let wSeason = 0, lSeason = 0;

  const bySport: Record<string, { w: number; l: number }> = {};

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

  // Filtered view by sport
  const filtered = selectedSport === "ALL"
    ? results
    : results.filter((r) => r.sport === selectedSport);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-line pb-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
            Track Record
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 tracking-normal uppercase font-semibold">
              Verified AI Picks
            </span>
          </h1>
          {wSeason + lSeason > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-sm">
              <Zap className="size-3.5 fill-emerald-400" />
              {pSeason}% Win Rate ({wSeason}-{lSeason})
            </div>
          )}
        </div>
        <p className="text-sm text-muted">
          Transparent history tracking only the AI's top recommended prediction favorite for each game market.
        </p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-muted">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          Loading verified AI track record...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary Card */}
          <div className="bg-panel border border-line rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-line">
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] uppercase tracking-wider text-muted mb-1 font-bold">7-Day Hit Rate</span>
              <span className="text-2xl font-mono font-bold text-ink">{w7}-{l7}</span>
              <span className={cn("text-sm font-bold font-mono", Number(p7) >= 55 ? "text-emerald-400" : "text-primary")}>
                {p7}%
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] uppercase tracking-wider text-muted mb-1 font-bold">30-Day Hit Rate</span>
              <span className="text-2xl font-mono font-bold text-ink">{w30}-{l30}</span>
              <span className={cn("text-sm font-bold font-mono", Number(p30) >= 55 ? "text-emerald-400" : "text-primary")}>
                {p30}%
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] uppercase tracking-wider text-muted mb-1 font-bold">Season Hit Rate</span>
              <span className="text-2xl font-mono font-bold text-ink">{wSeason}-{lSeason}</span>
              <span className={cn("text-sm font-bold font-mono", Number(pSeason) >= 55 ? "text-emerald-400" : "text-primary")}>
                {pSeason}%
              </span>
            </div>
          </div>

          {/* Sport Breakdown Filter Pills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted font-bold uppercase tracking-wider">
              <Filter className="size-3" /> Filter by Sport
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSport("ALL")}
                className={cn(
                  "border rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                  selectedSport === "ALL"
                    ? "bg-primary text-black border-primary"
                    : "bg-obsidian border-line text-muted hover:text-ink hover:bg-line/40"
                )}
              >
                All Sports ({results.length})
              </button>
              {Object.entries(bySport)
                .sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l))
                .map(([sport, rec]) => {
                  const total = rec.w + rec.l;
                  const pct = total > 0 ? (rec.w / total * 100).toFixed(1) : "0.0";
                  return (
                    <button
                      key={sport}
                      onClick={() => setSelectedSport(sport)}
                      className={cn(
                        "border rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs transition-colors cursor-pointer",
                        selectedSport === sport
                          ? "bg-primary text-black border-primary font-bold"
                          : "bg-obsidian border-line hover:border-line/80 hover:bg-line/30"
                      )}
                    >
                      <span className={selectedSport === sport ? "text-black font-bold" : "text-ink font-semibold"}>
                        {sport}
                      </span>
                      <span className={cn("font-mono text-xs", selectedSport === sport ? "text-black/80" : "text-muted")}>
                        {rec.w}-{rec.l} ({pct}%)
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Results List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                {selectedSport === "ALL" ? "All Verified AI Picks" : `${selectedSport} Picks`} ({filtered.length})
              </h2>
              <span className="text-[11px] text-muted">Showing 1 pick per market</span>
            </div>

            {filtered.map((r, i) => {
              const isWin = r.status === "WIN";
              const scoreText = r.result_away != null && r.result_home != null
                ? `${r.away} ${r.result_away} - ${r.home} ${r.result_home}`
                : null;

              return (
                <div
                  key={i}
                  className={cn(
                    "border rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all",
                    isWin ? "bg-panel/90 border-emerald-500/30" : "bg-panel/60 border-line/60 opacity-90"
                  )}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="shrink-0">
                      {isWin ? (
                        <CheckCircle2 className="size-5 text-emerald-400" />
                      ) : (
                        <XCircle className="size-5 text-red-400" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink truncate">
                          {r.selection}
                        </span>
                        {r.line != null && (
                          <span className="text-xs font-mono font-bold text-primary">
                            {r.line > 0 ? `+${r.line}` : r.line}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted truncate">
                        {r.away} @ {r.home}
                      </span>
                      {scoreText && (
                        <span className="text-[11px] font-mono text-zinc-400">
                          Final: {scoreText}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-obsidian border border-line px-1.5 py-0.2 rounded font-bold text-muted uppercase">
                          {r.sport}
                        </span>
                        <span className="text-[10px] text-muted uppercase font-semibold">
                          {r.market}
                        </span>
                        {r.edge != null && Number(r.edge) > 0 && (
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                            +{Number(r.edge).toFixed(1)}% Edge
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 text-right space-y-1">
                    <span className="text-xs font-mono font-bold text-primary">
                      {Math.round((r.model_prob || 0) * 100)}% AI
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                      isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {isWin ? "HIT" : "MISS"}
                    </span>
                    {r.graded_at && (
                      <span className="text-[10px] text-muted">
                        {new Date(r.graded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center p-8 text-muted border border-dashed border-line rounded-xl">
                No graded results found for {selectedSport}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
