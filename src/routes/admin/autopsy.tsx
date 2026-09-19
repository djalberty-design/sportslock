import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain, AlertTriangle } from "lucide-react";
import { getAutopsySummaryFn } from "@/lib/market/tape-server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/autopsy")({ component: AutopsyDashboard });

const BUCKET_LABEL: Record<string, string> = {
  model_miss: "Model miss",
  echoed_book: "Echoed the book",
  high_variance: "High variance",
  settled: "Settled",
  unreviewed: "Unreviewed",
};

function AutopsyDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["tape-autopsy"],
    queryFn: () => getAutopsySummaryFn(),
    refetchInterval: 60_000,
  });

  const buckets = data?.buckets ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
        <Brain className="size-5 text-primary" />
        Tape autopsy
      </h2>
      <p className="text-sm text-muted">
        Count-based read of graded game markets. This does not change the engine.
      </p>

      {isLoading || !data ? (
        <div className="text-center p-12 text-muted">Reading tape...</div>
      ) : data.error ? (
        <div className="text-sm text-red-400">{data.error}</div>
      ) : data.wins + data.losses + data.pushes === 0 ? (
        <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
          <Brain className="size-8 mx-auto mb-3 text-muted" />
          <p className="font-medium text-ink">No graded tape yet</p>
          <p className="text-sm mt-1">Open Live Status so finals can grade, then come back here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat n={data.wins} label="Wins" color="text-emerald-400" />
            <Stat n={data.losses} label="Losses" color="text-red-400" />
            <Stat n={data.pushes} label="Pushes" color="text-amber-400" />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Breakdown title="By bucket" rows={buckets.map((b) => ({ label: BUCKET_LABEL[b.bucket] || b.bucket, ...b }))} />
            <Breakdown title="By sport" rows={data.bySport.map((b) => ({ label: b.sport, ...b }))} />
            <Breakdown title="By market" rows={data.byMarket.map((b) => ({ label: b.market.toUpperCase(), ...b }))} />
          </div>

          <div className="space-y-3">
            {recent.map((row) => (
              <div key={row.id} className="bg-obsidian rounded-xl border border-line p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn("size-4 mt-0.5 shrink-0", row.status === "LOSS" ? "text-red-400" : row.status === "WIN" ? "text-emerald-400" : "text-amber-400")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold text-ink truncate">{row.away} at {row.home}</span>
                      <span className="font-mono text-xs text-muted">{row.sport} {row.marketType}{row.line != null ? ` ${row.line}` : ""}</span>
                      <span className={cn("text-xs font-bold", row.status === "LOSS" ? "text-red-400" : row.status === "WIN" ? "text-emerald-400" : "text-amber-400")}>
                        {row.status}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted">{BUCKET_LABEL[row.bucket] || row.bucket}</span>
                    </div>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{row.note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
      <div className={cn("text-2xl font-mono font-bold", color)}>{n}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; wins: number; losses: number; total: number }[] }) {
  return (
    <div className="bg-obsidian rounded-xl border border-line p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-muted">No graded rows.</p>}
      <div className="space-y-3">
        {rows.map((r) => {
          const decided = r.wins + r.losses;
          const pct = decided > 0 ? Math.round((r.wins / decided) * 100) : 0;
          return (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-ink">{r.label}</span>
                <span className="font-mono text-muted">{r.wins}-{r.losses} · {pct}%</span>
              </div>
              <div className="h-1.5 bg-line/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
