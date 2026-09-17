import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Brain, AlertTriangle, TrendingDown } from "lucide-react";
import { getPredictionLogs } from "@/lib/market/server";

export const Route = createFileRoute("/admin/autopsy")({ component: AutopsyDashboard });

type PredictionLog = {
  id: number;
  event_id: string;
  selection: string;
  market_type: string;
  model_probability: number;
  edge: number;
  status: string;
  actual_result?: string;
  ai_autopsy?: string;
  created_at: string;
};

function AutopsyDashboard() {
  const [logs, setLogs] = useState<PredictionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    getPredictionLogs()
      .then((data) => {
        // Only show lost predictions that have an autopsy
        const autopsies = (data as PredictionLog[]).filter(
          (l) => l.status === "LOST" && l.ai_autopsy
        );
        setLogs(autopsies);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
        <Brain className="size-5 text-primary" />
        AI Autopsy — Why We Were Wrong
      </h2>
      <p className="text-sm text-muted">
        After a prediction loses, the AI analyzes what went wrong — examining model assumptions,
        market conditions, and factors it may have underweighted.
      </p>

      {loading ? (
        <div className="text-center p-12 text-muted">Loading autopsy reports...</div>
      ) : logs.length === 0 ? (
        <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
          <Brain className="size-8 mx-auto mb-3 text-muted" />
          <p className="font-medium text-ink">No autopsy reports yet</p>
          <p className="text-sm mt-1">
            Autopsy reports are generated automatically after predictions are graded as losses.
            The grading cron runs daily.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-obsidian rounded-xl border border-line overflow-hidden cursor-pointer hover:border-red-500/30 transition-colors"
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            >
              {/* Header */}
              <div className="flex items-center gap-4 p-4">
                <AlertTriangle className="size-5 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-sm truncate">{log.selection}</div>
                  <div className="text-xs text-muted flex gap-3 mt-0.5">
                    <span className="font-mono">{log.market_type}</span>
                    <span>Model: {(log.model_probability * 100).toFixed(1)}%</span>
                    <span className="text-red-400">Edge: +{(log.edge * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted">
                  {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <TrendingDown className="size-4 text-red-400" />
              </div>

              {/* Expanded autopsy */}
              {expanded === log.id && (
                <div className="border-t border-line p-4 bg-red-500/5">
                  {log.actual_result && (
                    <div className="text-xs text-muted mb-3">
                      <span className="font-bold text-ink">Actual Result:</span> {log.actual_result}
                    </div>
                  )}
                  <div className="text-sm text-ink/90 whitespace-pre-wrap leading-relaxed">
                    {log.ai_autopsy}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
