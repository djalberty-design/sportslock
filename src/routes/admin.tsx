import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { ShieldAlert, Cpu, BarChart2, Brain, Activity, Lightbulb, UserCheck, Settings, Target, Sliders, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/use-access";

export const Route = createFileRoute("/admin")({ component: AdminOverseer });

const TABS = [
  { to: "/admin/brain", label: "Engine Bay", icon: Cpu },
  { to: "/admin/terminal", label: "Live Status", icon: Activity },
  { to: "/admin/predictions", label: "Predictions", icon: BarChart2 },
  { to: "/admin/autopsy", label: "AI Autopsy", icon: Brain },
  { to: "/admin/suggestions", label: "Suggestions", icon: Lightbulb },
  { to: "/admin/brain-intel", label: "Brain Intel", icon: Target },
  { to: "/admin/overrides", label: "Overrides", icon: Sliders },
  { to: "/admin/approvals", label: "Approvals", icon: UserCheck },
  { to: "/admin/activity", label: "Activity", icon: Clock },
];

function AdminOverseer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAccess();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-in fade-in">
        <ShieldAlert className="size-12 text-muted" />
        <h1 className="text-2xl font-display font-bold text-ink">Access Restricted</h1>
        <p className="text-muted text-sm max-w-md">
          The Overseer is only available to the super admin. Sign in with your admin account to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <ShieldAlert className="size-8 text-primary" />
          The Overseer
        </h1>
        <p className="text-muted text-sm">
          Research desk controls. Suggestions do not change the engine until you accept them and H5 is on.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 font-bold transition-all text-sm",
                active ? "bg-primary text-primary-foreground shadow-apex-glow" : "bg-panel text-muted hover:text-ink hover:bg-line/50"
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm min-h-[50vh]">
        <Outlet />
      </div>
    </div>
  );
}
