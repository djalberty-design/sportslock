import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Beaker, Hexagon, Ticket, Settings, History } from "lucide-react";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useAccess } from "@/lib/use-access";
import { getOddsQuotaFn } from "@/lib/market/server";
import { cn, formatKickoff } from "@/lib/utils";
import { TicketChip } from "./ticket-lock";
import { ThemeToggle, ThemeToggleIcon } from "./theme-toggle";

const TABS = [
  { to: "/", label: "AI Picks", icon: Hexagon },
  { to: "/picks", label: "The Lab", icon: Beaker },
  { to: "/games", label: "Matchups", icon: Activity },
  { to: "/ticket", label: "My Action", icon: Ticket },
  { to: "/results", label: "Track Record", icon: History },
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
  const [quota, setQuota] = useState<number | null>(null);

  // Fetch quota on mount for admin
  useEffect(() => {
    if (!isAdmin) return;
    getOddsQuotaFn().then(setQuota).catch(() => {});
    const interval = setInterval(() => getOddsQuotaFn().then(setQuota).catch(() => {}), 120_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Real sport season schedule → active daily pulls needed
  const quotaInfo = useMemo(() => {
    if (quota == null) return null;
    const now = new Date();
    const month = now.getMonth() + 1; // 1-indexed
    // Count active sports this month (matches getActiveSports in odds-api.ts)
    let activeSports = 0;
    if (month >= 9 || month <= 2) activeSports++; // NFL: Sep-Feb (reg+playoffs)
    if (month >= 8 || month <= 1) activeSports++; // NCAAF: Aug-Jan
    if (month >= 3 && month <= 11) activeSports++; // MLB: Mar-Nov (reg+playoffs)
    if (month >= 10 || month <= 6) activeSports++; // NBA: Oct-Jun
    if (month >= 10 || month <= 6) activeSports++; // NHL: Oct-Jun
    if (month >= 11 || month <= 4) activeSports++; // NCAAB: Nov-Apr

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate();
    const reservedForDaily = daysLeft * activeSports;
    const propsAvail = Math.max(0, quota - reservedForDaily);
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetLabel = resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { propsAvail, activeSports, daysLeft, reservedForDaily, resetLabel };
  }, [quota]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground pb-16 md:pb-0 md:flex-row w-full max-w-full overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 z-50 bg-obsidian border-b border-line/50 pt-[env(safe-area-inset-top,0px)]">
        <div className="h-7 flex items-center justify-between px-3 sm:px-4 text-[10px] font-bold uppercase tracking-widest text-muted">
          <div className="flex items-center gap-2 shrink-0">
            <DeskStamp />
          </div>
          {isAdmin && quota != null && quotaInfo && (
            <div className="flex items-center gap-1.5 sm:gap-2 normal-case tracking-normal shrink-0 text-[10px]" title={`${quotaInfo.activeSports} sports × ${quotaInfo.daysLeft} days = ${quotaInfo.reservedForDaily} reserved for daily pulls. Resets ${quotaInfo.resetLabel}.`}>
              <span className={cn("font-mono font-bold", quotaInfo.propsAvail < 20 ? "text-red-400" : quotaInfo.propsAvail < 80 ? "text-amber-400" : "text-emerald-400")}>
                ⚡ {quotaInfo.propsAvail} <span className="hidden sm:inline">prop pulls</span><span className="sm:hidden">props</span>
              </span>
              <span className="text-muted/40 hidden sm:inline">|</span>
              <span className="text-muted/60 font-mono hidden sm:inline">{quota}/500</span>
              <span className="text-muted/40 hidden md:inline">|</span>
              <span className="text-muted/50 hidden md:inline">resets {quotaInfo.resetLabel}</span>
            </div>
          )}
        </div>
      </div>
      {/* Mobile Bottom App Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-line/80 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden w-full max-w-full">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors min-w-0 px-0.5 text-center",
                active ? "text-primary" : "text-muted hover:text-ink",
              )}
            >
              <tab.icon className="size-5 shrink-0" />
              <span className="text-[9px] font-medium tracking-tight truncate max-w-full">{tab.label}</span>
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
          <ThemeToggle />
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
      <main className="flex-1 bg-background relative mt-[calc(1.75rem+env(safe-area-inset-top,0px))] md:mt-7 w-full max-w-full overflow-x-hidden" id="main">
        {/* Top Header for Mobile */}
        <header className="sticky top-[calc(1.75rem+env(safe-area-inset-top,0px))] z-40 flex h-14 items-center justify-between border-b border-line bg-background/95 px-3 backdrop-blur-md md:hidden w-full max-w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="flex items-center gap-1.5 shrink-0 text-ink">
              <Hexagon className="size-5 text-primary shrink-0" />
              <span className="font-display font-bold tracking-tight text-sm">SportsLock</span>
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors shrink-0 shadow-sm",
                  isActive(pathname, "/admin")
                    ? "bg-primary text-black border-primary font-extrabold"
                    : "bg-primary/15 text-primary border-primary/40 hover:bg-primary/25"
                )}
                title="The Overseer"
              >
                <Settings className="size-3.5" />
                <span>Overseer</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
             <ThemeToggleIcon />
             <TicketChip />
             <UserButton compact />
          </div>
        </header>

        <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8 w-full max-w-full overflow-x-hidden pt-3 sm:pt-6">
          {children}
          {isAdmin && (
            <div className="md:hidden mt-8 mb-16 pt-4 border-t border-line/40 flex items-center justify-between px-2 text-xs text-muted">
              <span>Overseer Management</span>
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg border transition-colors",
                  isActive(pathname, "/admin")
                    ? "bg-primary text-black border-primary"
                    : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                )}
              >
                <Settings className="size-3.5" />
                <span>Open The Overseer</span>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
