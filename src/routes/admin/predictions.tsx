import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { BarChart2, TrendingUp, TrendingDown, Clock, Target } from "lucide-react";
import { getPredictionLogs } from "@/lib/market/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/predictions")({ component: PredictionDashboard });

type PredictionLog = {
  id: number;
  event_id: string;
  selection: string;
  market_type: string;
  line?: number;
  price?: number;
  model_probability: number;
  edge: number;
  status: "PENDING" | "WON" | "LOST" | "PUSH";
  actual_result?: string;
  ai_autopsy?: string;
  created_at: string;
};

function PredictionDashboard() {
  const [logs, setLogs] = useState<PredictionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPredictionLogs()
      .then((data) => setLogs(data as PredictionLog[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Stats
  const isWin = (s: string) => s === "WON" || s === "WIN";
  const isLoss = (s: string) => s === "LOST" || s === "LOSS";
  const graded = logs.filter((l) => isWin(l.status) || isLoss(l.status));
  const won = graded.filter((l) => isWin(l.status)).length;
  const lost = graded.filter((l) => isLoss(l.status)).length;
  const pending = logs.filter((l) => l.status === "PENDING").length;
  const winRate = graded.length > 0 ? ((won / graded.length) * 100).toFixed(1) : "-";
  const avgEdgeWin = won > 0
    ? (graded.filter((l) => isWin(l.status)).reduce((s, l) => s + (l.edge || 0), 0) / won * 100).toFixed(1)
    : "-";
  const avgEdgeLoss = lost > 0
    ? (graded.filter((l) => isLoss(l.status)).reduce((s, l) => s + (l.edge || 0), 0) / lost * 100).toFixed(1)
    : "-";

  const statusColor: Record<string, string> = {
    WON: "text-emerald-400 bg-emerald-500/10",
    WIN: "text-emerald-400 bg-emerald-500/10",
    LOST: "text-red-400 bg-red-500/10",
    LOSS: "text-red-400 bg-red-500/10",
    PUSH: "text-amber-400 bg-amber-500/10",
    PENDING: "text-muted bg-line/50",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
        <BarChart2 className="size-5 text-primary" />
        Prediction Tracker
      </h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-ink">{logs.length}</div>
          <div className="text-xs text-muted mt-1">Total Logged</div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-emerald-400">{won}</div>
          <div className="text-xs text-muted mt-1">Won</div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-red-400">{lost}</div>
          <div className="text-xs text-muted mt-1">Lost</div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-primary">{winRate}%</div>
          <div className="text-xs text-muted mt-1">Win Rate</div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-amber-400">{pending}</div>
          <div className="text-xs text-muted mt-1">Pending</div>
        </div>
      </div>

      {/* Edge analysis */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-obsidian rounded-xl border border-line p-4 flex items-center gap-3">
          <TrendingUp className="size-5 text-emerald-400" />
          <div>
            <div className="font-bold text-ink text-sm">Avg Edge (Winners)</div>
            <div className="text-xs text-emerald-400 font-mono">+{avgEdgeWin}%</div>
          </div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 flex items-center gap-3">
          <TrendingDown className="size-5 text-red-400" />
          <div>
            <div className="font-bold text-ink text-sm">Avg Edge (Losers)</div>
            <div className="text-xs text-red-400 font-mono">+{avgEdgeLoss}%</div>
          </div>
        </div>
      </div>

      {/* Prediction log table */}
      {loading ? (
        <div className="text-center p-12 text-muted">Loading predictions...</div>
      ) : logs.length === 0 ? (
        <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
          <Target className="size-8 mx-auto mb-3 text-muted" />
          <p className="font-medium text-ink">No predictions logged yet</p>
          <p className="text-sm mt-1">Lock in tickets from the Game Ticket page to start tracking.</p>
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
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line/50 hover:bg-obsidian/50">
                  <td className="py-3 px-2 font-medium text-ink max-w-[200px] truncate">{log.selection}</td>
                  <td className="py-3 px-2 text-muted font-mono text-xs">{log.market_type}</td>
                  <td className="py-3 px-2 text-right font-mono text-primary">
                    {(log.model_probability * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-emerald-400">
                    +{(log.edge * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={cn("px-2 py-1 rounded-md text-xs font-bold", statusColor[log.status] || "text-muted")}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted text-xs">
                    {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
