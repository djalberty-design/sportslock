import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart2 } from "lucide-react";
import { getAutopsySummaryFn, getTapeDeskFn, getTapeStatsFn } from "@/lib/market/tape-server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/predictions")({ component: PredictionDashboard });

function PredictionDashboard() {
  const tape = useQuery({ queryKey: ["tape-stats"], queryFn: () => getTapeStatsFn() });
  const autopsy = useQuery({ queryKey: ["tape-autopsy"], queryFn: () => getAutopsySummaryFn() });
  const desk = useQuery({ queryKey: ["tape-desk"], queryFn: () => getTapeDeskFn() });

  const stats = tape.data;
  const rows = (desk.data && desk.data.length ? desk.data : autopsy.data?.recent) ?? [];
  const wins = autopsy.data?.wins ?? stats?.wins ?? 0;
  const losses = autopsy.data?.losses ?? stats?.losses ?? 0;
  const pending = stats?.pendingGrades ?? 0;
  const graded = wins + losses + (autopsy.data?.pushes ?? 0);
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "-";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
        <BarChart2 className="size-5 text-primary" />
        Prediction tape
      </h2>
      <p className="text-sm text-muted">Every snap on `market_tape` — pregame, live, and final. This is the autopsy log, not a hidden gold-only list.</p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile n={stats?.total ?? 0} label="Snaps" />
        <Tile n={wins} label="Won" color="text-emerald-400" />
        <Tile n={losses} label="Lost" color="text-red-400" />
        <Tile n={`${winRate}%`} label="Win rate" color="text-primary" />
        <Tile n={pending} label="Pending" color="text-amber-400" />
      </div>

      {tape.isLoading || autopsy.isLoading || desk.isLoading ? (
        <div className="text-center p-12 text-muted">Reading tape...</div>
      ) : rows.length === 0 && !graded ? (
        <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
          <p className="font-medium text-ink">No graded game markets yet</p>
          <p className="text-sm mt-1">Open Live Status after finals. Pending snaps wait until the box is official.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted text-xs uppercase tracking-wider">
                <th className="py-3 px-2">Selection</th>
                <th className="py-3 px-2">Type</th>
                <th className="py-3 px-2 text-right">Model %</th>
                <th className="py-3 px-2 text-right">Edge</th>
                <th className="py-3 px-2 text-center">Phase</th>
                <th className="py-3 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id} className="border-b border-line/50">
                  <td className="py-3 px-2 font-medium text-ink max-w-[220px] truncate">
                    {log.selection}
                    <div className="text-[10px] text-muted truncate">{log.away} at {log.home}</div>
                  </td>
                  <td className="py-3 px-2 text-muted font-mono text-xs">{log.marketType}{log.line != null ? ` ${log.line}` : ""}</td>
                  <td className="py-3 px-2 text-right font-mono text-primary">
                    {log.modelProb != null ? `${Math.min(99, Math.max(1, log.modelProb * 100)).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-emerald-400">
                    {log.edge != null ? `${log.edge >= 0 ? "+" : ""}${(log.edge * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-3 px-2 text-center text-[10px] uppercase tracking-wider text-muted">{(log as any).phase || "—"}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-xs font-bold",
                      log.status === "WIN" ? "text-emerald-400 bg-emerald-500/10" :
                      log.status === "LOSS" ? "text-red-400 bg-red-500/10" :
                      log.status === "PUSH" ? "text-amber-400 bg-amber-500/10" :
                      "text-muted bg-line/50",
                    )}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tile({ n, label, color }: { n: string | number; label: string; color?: string }) {
  return (
    <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
      <div className={cn("text-2xl font-mono font-bold", color || "text-ink")}>{n}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}
