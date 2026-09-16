import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { formatBetUsd, formatChancePct } from "@/lib/copy";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { useDeskDecision } from "@/lib/market/use-board";
import { deskPickFromLegRefs, lookupPick, parlayTicketIdFromLegs, resolveTicketId } from "@/lib/market/picks";
import { isCollegeSport } from "@/lib/market/universe";
import { cn } from "@/lib/utils";

/**
 * Scroll-aware floating combo badge. Hides on scroll-down so it never
 * covers Photograph / Confirm buttons. Shows again on scroll-up.
 */
export function CollapsibleParlayPill() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchId = useRouterState({ select: (s) => String((s.location.search as { id?: string })?.id ?? "") });
  const legs = useDeskStore((s) => s.parlayLegs);
  const stake = useDeskStore(selectUnit);
  const { scan, snapshot } = useDeskDecision();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = typeof window === "undefined" ? 0 : window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const prev = lastY.current;
        if (y > prev + 8 && y > 48) setHidden(true);
        else if (y < prev - 8 || y < 24) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!legs.length || pathname.startsWith("/parlay") || pathname.startsWith("/game")) return null;
  const legal = legs.filter((l) => !(l.marketType === "prop" && isCollegeSport(l.sport)));
  if (legal.length < 2) return null;
  const onTicket = pathname.startsWith("/ticket");
  const urlId = onTicket ? resolveTicketId(searchId) : "";
  const storeId = parlayTicketIdFromLegs(legal);
  const id = urlId || storeId;
  const pick =
    scan && snapshot
      ? onTicket
        ? lookupPick(id, scan, snapshot) ?? (searchId && searchId !== id ? lookupPick(searchId, scan, snapshot) : null)
        : (lookupPick(id, scan, snapshot) ?? deskPickFromLegRefs(legal, scan))
      : null;
  const chance = pick?.chance;
  const pct = chance != null && Number.isFinite(chance) ? formatChancePct(chance) : null;
  const payout = pick?.decimalPayout ?? 0;
  const hit = stake > 0 && payout > 1 ? stake * payout : null;
  const profit = hit != null ? hit - stake : null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-16 z-30 px-3 pb-[env(safe-area-inset-bottom)] transition-[transform,opacity] duration-200 ease-[var(--ease-out-soft)]",
        hidden ? "translate-y-24 opacity-0" : "translate-y-0 opacity-100",
      )}
      aria-hidden={hidden}
    >
      <Link
        to="/ticket"
        search={{ id }}
        hash={onTicket ? "lock-in" : undefined}
        tabIndex={hidden ? -1 : 0}
        className={cn(
          "pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-3 rounded-lg bg-gold px-4 py-2.5 text-navy-deep shadow-[var(--shadow-stamp)]",
          hidden && "pointer-events-none",
        )}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            Combo · {legal.length} picks
            {pct ? ` · ${pct} they all hit` : ""}
          </span>
          {hit != null ? (
            <span className="block text-xs">
              Hit {formatBetUsd(hit)}
              {profit != null && profit > 0 ? ` · +${formatBetUsd(profit)}` : ""} on {formatBetUsd(stake)}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-sm font-semibold underline-offset-4">
          {onTicket ? "Fast Log to lock this price" : "Open ticket"}
        </span>
      </Link>
    </div>
  );
}

/** @deprecated Use CollapsibleParlayPill */
export const ParlayTray = CollapsibleParlayPill;
