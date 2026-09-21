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

  // --- TOTALS: Over/Under ---
  if (desc.includes("total") || desc.includes("over") || desc.includes("under")) {
    const line = (ticket as any).point ?? (ticket as any).line;
    if (line == null) return "void"; // No line stored — can't grade
    const totalScore = hs + as;
    if (totalScore === Number(line)) return "void"; // push
    const isOver = /\bover\b/i.test(desc);
    const isUnder = /\bunder\b/i.test(desc);
    if (!isOver && !isUnder) return "void";
    if (isOver) return totalScore > Number(line) ? "win" : "loss";
    return totalScore < Number(line) ? "win" : "loss";
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
    const line = (ticket as any).point ?? (ticket as any).line;
    if (line == null) return "void"; // No line stored — can't grade
    const margin = pickedHome ? (hs - as) : (as - hs);
    const covered = margin + Number(line);
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
 * Uses the existing snapshot data (free ESPN scores).
 * Keeps manual Hit/Miss/Push buttons as override.
 */
export function useAutoGrade(snapshot: DeskSnapshot | undefined) {
  const paperTickets = useDeskStore((s) => s.paperTickets);
  const grade = useDeskStore((s) => s.gradeTicket);
  const [notifications, setNotifications] = useState<GradeNotification[]>([]);
  const gradedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!snapshot?.quotes?.length) return;

    const open = paperTickets.filter((t) => t.status === "open");
    if (!open.length) return;

    const newNotifs: GradeNotification[] = [];

    for (const ticket of open) {
      // Skip if already auto-graded this session
      if (gradedRef.current.has(ticket.id)) continue;

      const quote = findMatchingQuote(ticket, snapshot.quotes);
      if (!quote) continue;

      // Only grade if game is final
      if (!isGameFinal(quote)) continue;

      // Try to determine result
      const result = gradeMoneyline(ticket, quote);

      // Only auto-grade clear win/loss — leave pushes and uncertain for manual
      if (result === "void") continue;

      // Grade it!
      grade(ticket.id, result, quote.homeScore != null ? undefined : undefined);
      gradedRef.current.add(ticket.id);

      // Calculate P/L for notification
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
