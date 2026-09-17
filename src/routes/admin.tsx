import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Terminal, Settings, ShieldAlert, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminOverseer });

const TABS = [
  { to: "/admin/brain", label: "Engine Bay", icon: Cpu },
  { to: "/admin/terminal", label: "Telemetry", icon: Terminal },
];

function AdminOverseer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <h1 className="text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-3">
          <ShieldAlert className="size-8 text-primary" />
          The Overseer
        </h1>
        <p className="text-muted text-sm">
          God-mode access. Throttle the Apex AI, manage waitlists, and view live telemetry.
        </p>
      </div>

      {/* Internal Navigation */}
      <nav className="flex gap-4">
        {TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 font-bold transition-all",
                active ? "bg-primary text-primary-foreground shadow-apex-glow" : "bg-panel text-muted hover:text-ink hover:bg-line/50"
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Main Panel Content */}
      <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm min-h-[50vh]">
        <Outlet />
      </div>
    </div>
  );
}