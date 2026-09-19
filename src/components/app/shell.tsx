import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Beaker, Hexagon, Ticket, Settings } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useAccess } from "@/lib/use-access";
import { cn, formatKickoff } from "@/lib/utils";
import { TicketChip } from "./ticket-lock";

const TABS = [
  { to: "/", label: "SportsLock", icon: Hexagon },
  { to: "/picks", label: "The Lab", icon: Beaker },
  { to: "/games", label: "Matchups", icon: Activity },
  { to: "/ticket", label: "My Action", icon: Ticket },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function DeskStamp() {
  const [stamp, setStamp] = useState("");
  useEffect(() => {
    const tick = () => setStamp(formatKickoff(new Date().toISOString(), true));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
      {stamp ? `Desk ${stamp}` : "Desk"}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAccess();

  return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground pb-16 md:pb-0 md:flex-row">
      <div className="fixed top-0 left-0 right-0 z-50 h-7 bg-obsidian border-b border-line/50 flex items-center justify-between px-4 text-[10px] font-bold uppercase tracking-widest text-muted">
        <div className="flex items-center gap-4">
          <DeskStamp />
        </div>
      </div>
      {/* Mobile Bottom App Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-line/80 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                active ? "text-primary" : "text-muted hover:text-ink",
              )}
            >
              <tab.icon className="size-5" />
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Side Rail */}
      <aside className="sticky top-7 hidden h-[calc(100dvh-1.75rem)] w-64 flex-col border-r border-line bg-panel md:flex mt-7">
        <div className="flex h-16 items-center gap-3 px-6">
          <Hexagon className="size-6 text-primary" />
          <span className="font-display text-xl font-bold tracking-tight text-ink">SportsLock AI</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted hover:bg-line/50 hover:text-ink",
                )}
              >
                <tab.icon className="size-5" />
                <span className="font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-3 border-t border-line/50 flex flex-col gap-2">
          <UserButton />
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                isActive(pathname, "/admin") ? "bg-primary/10 text-primary" : "text-muted hover:bg-line/50 hover:text-ink"
              )}
            >
              <Settings className="size-5" />
              <span className="font-medium">The Overseer</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-background relative mt-7" id="main">
        {/* Top Header for Mobile */}
        <header className="sticky top-7 z-40 flex h-14 items-center justify-between border-b border-line bg-background/90 px-4 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2">
            <Hexagon className="size-5 text-primary" />
            <span className="font-display font-bold tracking-tight">SportsLock AI</span>
          </div>
          <div className="flex items-center gap-3">
             <TicketChip />
             <UserButton />
             {isAdmin && (
               <Link to="/admin" className="text-muted hover:text-primary">
                 <Settings className="size-5" />
               </Link>
             )}
          </div>
        </header>

        <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
