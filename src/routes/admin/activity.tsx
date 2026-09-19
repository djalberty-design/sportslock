import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cn } from "@/lib/utils";
import { Activity, Clock, Cpu, Brain, UserCheck, Sliders, Zap, AlertTriangle } from "lucide-react";

type ActivityEntry = {
  id: string;
  type: string;
  action: string;
  detail: string;
  timestamp: string;
  source: string;
};

const getActivityLogFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<ActivityEntry[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    try {
      // Ensure activity log table
      await sql.query(`
        create table if not exists desk_activity_log (
          id uuid primary key default gen_random_uuid(),
          type text not null,
          action text not null,
          detail text,
          source text not null default 'system',
          created_at timestamptz not null default now()
        )
      `);
      await sql.query(`create index if not exists activity_log_time_idx on desk_activity_log (created_at desc)`);

      const rows = await sql.query<Record<string, unknown>>(
        `select id, type, action, detail, source, created_at
         from desk_activity_log
         order by created_at desc
         limit 100`,
      );
      return rows.map((r) => ({
        id: String(r.id),
        type: String(r.type || ""),
        action: String(r.action || ""),
        detail: String(r.detail || ""),
        timestamp: String(r.created_at || ""),
        source: String(r.source || "system"),
      }));
    } catch {
      return [];
    }
  });

export const Route = createFileRoute("/admin/activity")({ component: ActivityLogPage });

const TYPE_ICONS: Record<string, typeof Activity> = {
  cron: Clock,
  engine: Cpu,
  brain: Brain,
  access: UserCheck,
  override: Sliders,
  suggestion: Zap,
};

const TYPE_COLORS: Record<string, string> = {
  cron: "text-blue-400 bg-blue-500/10",
  engine: "text-emerald-400 bg-emerald-500/10",
  brain: "text-primary bg-primary/10",
  access: "text-amber-400 bg-amber-500/10",
  override: "text-purple-400 bg-purple-500/10",
  suggestion: "text-cyan-400 bg-cyan-500/10",
  error: "text-red-400 bg-red-500/10",
};

function ActivityLogPage() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["activity-log"],
    queryFn: () => getActivityLogFn(),
    refetchInterval: 30_000,
  });

  const rows = entries ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl text-ink flex items-center gap-2">
          <Activity className="size-6 text-primary" /> Activity Log
        </h2>
        <p className="text-sm text-muted mt-1">
          Chronological feed of everything the system does. Crons, overrides, access decisions, and brain actions.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted">Loading...</p>}

      {rows.length === 0 && !isLoading && (
        <div className="bg-wash rounded-xl p-8 text-center">
          <Clock className="size-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">No activity logged yet. Events will appear as crons run and actions are taken.</p>
          <p className="text-[10px] text-muted mt-2">Activity is recorded by sweep, grade, brain-learn, and suggestion crons.</p>
        </div>
      )}

      <div className="space-y-1">
        {rows.map((entry) => {
          const Icon = TYPE_ICONS[entry.type] || AlertTriangle;
          const colorClass = TYPE_COLORS[entry.type] || "text-muted bg-wash";
          const dt = new Date(entry.timestamp);
          const timeStr = dt.toLocaleString(undefined, {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          });

          return (
            <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-wash/50 transition-colors">
              <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{entry.action}</span>
                  <span className={cn("text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded", colorClass)}>
                    {entry.type}
                  </span>
                </div>
                {entry.detail && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{entry.detail}</p>
                )}
              </div>
              <span className="text-[10px] text-muted font-mono whitespace-nowrap shrink-0">{timeStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
