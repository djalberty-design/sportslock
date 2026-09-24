import { useEffect, useRef, useState } from "react";
import { useDeskStore } from "@/lib/desk-store";
import type { DeskSnapshot, QuoteLine } from "@/lib/market/types";
import type { PaperTicket } from "@/lib/market/types";

/** How often to check (ms). ESPN data refreshes every ~60s via the board query. */
const POLL_MS = 5 * 60_000; // 5 minutes

export type GradeNotification = {
  id: string;
  ticketDesc: string;
  result: "win" | "loss" | "void";
  pnl: number;
  ts: number;
};

/**
 * Checks if a game is finished based on quote data.
 */
function isGameFinal(q: QuoteLine): boolean {
  if (q.start && new Date(q.start).getTime() > Date.now()) return false;
  if ((q as any).inPlay) return false;
  if ((q as any).complete) return true;
  const st = String(q.statusText || "").toLowerCase();
  return /(final|official|game over|completed)/.test(st);
}

/**
 * Determines if a moneyline/spread ticket hit based on scores.
 * Returns "win" | "loss" | "void" (push).
 */
function gradeMoneyline(ticket: PaperTicket, q: QuoteLine): "win" | "loss" | "void" {
  const hs = q.homeScore ?? 0;
  const as = q.awayScore ?? 0;
  const desc = ticket.description.toLowerCase();

  // Determine which side the user picked
  const home = (ticket.home || "").toLowerCase();
  const away = (ticket.away || "").toLowerCase();

  // Resolve the line: prefer ticket.point, then try quote's point/line, or parse from description
  let ticketLine = ticket.point ?? (q as any).point ?? (q as any).line;
  if (ticketLine == null) {
    const lineMatch = ticket.description.match(/([+-]\d+(?:\.\d+)?)/);
    if (lineMatch) ticketLine = Number(lineMatch[1]);
  }

  // --- TOTALS: Over/Under ---
  if (desc.includes("total") || desc.includes("over") || desc.includes("under")) {
    if (ticketLine == null) return "void"; // No line stored — can't grade
    const totalScore = hs + as;
    if (totalScore === Number(ticketLine)) return "void"; // push
    const isOver = /\bover\b/i.test(desc);
    const isUnder = /\bunder\b/i.test(desc);
    if (!isOver && !isUnder) return "void";
    if (isOver) return totalScore > Number(ticketLine) ? "win" : "loss";
    return totalScore < Number(ticketLine) ? "win" : "loss";
  }

  // --- Figure out which team the user bet on ---
  let pickedHome = false;
  if (home && desc.includes(home)) pickedHome = true;
  else if (away && desc.includes(away)) pickedHome = false;
  else {
    const qHome = (q.home || "").toLowerCase();
    const qAway = (q.away || "").toLowerCase();
    if (desc.includes(qHome)) pickedHome = true;
    else if (desc.includes(qAway)) pickedHome = false;
    else return "void"; // Can't determine side — skip
  }

  // --- SPREADS ---
  if (desc.includes("spread")) {
    if (ticketLine == null) {
      // MLB runline fallback
      const isFav = ticket.price != null && ticket.price < -180;
      ticketLine = isFav ? 1.5 : -1.5;
    }
    const margin = pickedHome ? (hs - as) : (as - hs);
    const covered = margin + Number(ticketLine);
    if (covered === 0) return "void"; // push
    return covered > 0 ? "win" : "loss";
  }

  // --- MONEYLINE ---
  if (hs === as) return "void"; // Tie / push

  if (pickedHome) {
    return hs > as ? "win" : "loss";
  } else {
    return as > hs ? "win" : "loss";
  }
}

/**
 * Try to match a paper ticket to a quote from the snapshot.
 * Matches by gameIds (eventId) or by home/away team names.
 */
function findMatchingQuote(ticket: PaperTicket, quotes: QuoteLine[]): QuoteLine | null {
  // First try matching by eventId
  for (const gid of ticket.gameIds || []) {
    const match = quotes.find((q) => q.eventId === gid);
    if (match) return match;
  }

  // Fallback: match by team names
  if (ticket.home && ticket.away) {
    const th = ticket.home.toLowerCase();
    const ta = ticket.away.toLowerCase();
    return (
      quotes.find((q) => {
        const qh = (q.home || "").toLowerCase();
        const qa = (q.away || "").toLowerCase();
        return (qh.includes(th) || th.includes(qh)) && (qa.includes(ta) || ta.includes(qa));
      }) ?? null
    );
  }

  return null;
}

/**
 * Hook that auto-grades open paper tickets when games go final.
 * Uses both live snapshot data AND the server settlePaperTicketsFn
 * (which queries ESPN live + historical scores and graded market_tape).
 */
export function useAutoGrade(snapshot: DeskSnapshot | undefined) {
  const paperTickets = useDeskStore((s) => s.paperTickets);
  const grade = useDeskStore((s) => s.gradeTicket);
  const [notifications, setNotifications] = useState<GradeNotification[]>([]);
  const gradedRef = useRef<Set<string>>(new Set());

  // 1. Server-backed 100% automated settlement
  useEffect(() => {
    const open = paperTickets.filter((t) => t.status === "open");
    if (!open.length) return;

    let cancelled = false;

    const runServerSettle = async () => {
      try {
        const { settlePaperTicketsFn } = await import("@/lib/market/server");
        const res = await settlePaperTicketsFn({ data: { tickets: open } });
        if (cancelled || !res?.ok || !res.settled?.length) return;

        const newNotifs: GradeNotification[] = [];

        for (const item of res.settled) {
          if (gradedRef.current.has(item.id)) continue;
          gradedRef.current.add(item.id);

          const ticket = open.find((t) => t.id === item.id);
          grade(item.id, item.result, (item as any).closePrice, {
            finalScore: item.finalScore,
            legs: item.settledLegs,
          });

          if (ticket) {
            const dec = ticket.price != null
              ? (ticket.price >= 0 ? ticket.price / 100 + 1 : 100 / Math.abs(ticket.price) + 1)
              : 2;
            const pnl = item.result === "win" ? ticket.stake * dec - ticket.stake : item.result === "void" ? 0 : -ticket.stake;

            newNotifs.push({
              id: item.id,
              ticketDesc: ticket.description,
              result: item.result,
              pnl,
              ts: Date.now(),
            });
          }
        }

        if (newNotifs.length) {
          setNotifications((prev) => [...newNotifs, ...prev].slice(0, 10));
        }
      } catch (e) {
        console.error("Auto settle error:", e);
      }
    };

    runServerSettle();
    const timer = setInterval(runServerSettle, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [paperTickets, grade]);

  // 2. Client-side instant settlement for in-memory board snapshot
  useEffect(() => {
    if (!snapshot?.quotes?.length) return;

    const open = paperTickets.filter((t) => t.status === "open");
    if (!open.length) return;

    const newNotifs: GradeNotification[] = [];

    for (const ticket of open) {
      if (gradedRef.current.has(ticket.id)) continue;
      if (ticket.start && new Date(ticket.start).getTime() > Date.now()) continue;

      const quote = findMatchingQuote(ticket, snapshot.quotes);
      if (!quote) continue;

      if (!isGameFinal(quote)) continue;

      const result = gradeMoneyline(ticket, quote);
      if (result === "void") continue;

      grade(ticket.id, result, quote.homeScore != null ? undefined : undefined, {
        finalScore: quote.homeScore != null && quote.awayScore != null ? `${quote.away || "Away"} ${quote.awayScore} - ${quote.home || "Home"} ${quote.homeScore}` : undefined,
      });
      gradedRef.current.add(ticket.id);

      const dec = ticket.price != null
        ? (ticket.price >= 0 ? ticket.price / 100 + 1 : 100 / Math.abs(ticket.price) + 1)
        : 2;
      const pnl = result === "win" ? ticket.stake * dec - ticket.stake : -ticket.stake;

      newNotifs.push({
        id: ticket.id,
        ticketDesc: ticket.description,
        result,
        pnl,
        ts: Date.now(),
      });
    }

    if (newNotifs.length) {
      setNotifications((prev) => [...newNotifs, ...prev].slice(0, 10));
    }
  }, [snapshot?.quotes, paperTickets, grade]);

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const dismissAll = () => setNotifications([]);

  return { notifications, dismiss, dismissAll };
}

/**
 * Toast banner component for auto-grade notifications.
 */
export function AutoGradeToasts({
  notifications,
  onDismiss,
}: {
  notifications: GradeNotification[];
  onDismiss: (id: string) => void;
}) {
  if (!notifications.length) return null;

  return (
    <div className="fixed top-10 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.slice(0, 3).map((n) => (
        <div
          key={n.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur-md animate-in slide-in-from-right duration-300 ${
            n.result === "win"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          <span className="text-lg">{n.result === "win" ? "✅" : "❌"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">
              {n.result === "win" ? "Hit!" : "Miss"} — {n.ticketDesc}
            </p>
            <p className="text-xs opacity-75">
              {n.result === "win" ? "+" : ""}${Math.abs(n.pnl).toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            className="text-xs opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
