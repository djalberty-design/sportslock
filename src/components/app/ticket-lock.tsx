import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatBetUsd, formatChancePct, profitOnStake, shortPick } from "@/lib/copy";
import { useDeskStore, selectTicketPulse, selectUnit } from "@/lib/desk-store";
import { americanToDecimal, decimalToAmerican, product } from "@/lib/market/engine";
import { lineShiftAlert } from "@/lib/market/edge";
import { photoBlockedReason, photoVerdict } from "@/lib/market/photo-law";
import { namesHit } from "@/lib/market/research";
import type { PaperTicket, ParsedTicket, ScanRow } from "@/lib/market/types";
import { cn, formatAmerican } from "@/lib/utils";
import { WagerMeter, HitReadout, ticketMath } from "./wager-meter";

export function delayedMatch(rows: ScanRow[], ticket: ParsedTicket): ScanRow | undefined {
  return rows.find(
    (r) =>
      namesHit(r.home, ticket.home) &&
      namesHit(r.away, ticket.away) &&
      r.marketType === ticket.marketType &&
      (r.side === ticket.side || namesHit(r.selection, ticket.selection)),
  );
}

export function TicketReview({
  draft,
  legs,
  rows,
  onLock,
  error,
}: {
  draft?: ParsedTicket;
  legs?: ParsedTicket[];
  rows: ScanRow[];
  onLock: () => void;
  error?: string | null;
}) {
  const multi = (legs?.filter((l) => l.selection && Number.isFinite(l.price)) ?? []).length >= 2;
  const items = multi ? (legs ?? []).filter((l) => l.selection && Number.isFinite(l.price)) : draft ? [draft] : [];
  if (!items.length) return null;

  const delayed = items.map((t) => delayedMatch(rows, t));
  const livePrices = items.map((t) => t.price);
  const delayedPrices = delayed.map((r, i) => r?.price ?? livePrices[i]);
  const fairs = items.map((_, i) => delayed[i]?.fairProb).filter((p): p is number => p != null && Number.isFinite(p) && p > 0);
  const chance = fairs.length === items.length ? (multi ? product(fairs) : fairs[0]) : undefined;
  const decimal = product(livePrices.map((p) => americanToDecimal(p)));
  const delayedDecimal = product(delayedPrices.map((p) => americanToDecimal(p)));
  const liveAmerican = items.length === 1 ? livePrices[0] : decimalToAmerican(decimal);
  const delayedAmerican = items.length === 1 ? delayedPrices[0] : decimalToAmerican(delayedDecimal);
  const moved = delayedAmerican !== liveAmerican;
  const blocked = photoBlockedReason(items);
  const verdict = photoVerdict(chance, liveAmerican);
  const title =
    items.length === 1
      ? shortPick(items[0].selection, items[0].marketType)
      : `${items.length}-game parlay`;

  return (
    <div className="mt-5 space-y-4 rounded-md bg-wash p-4 ring-1 ring-gold/40">
      <div>
        <p className="stamp text-emerald-500">Not on Log yet · check the live number</p>
        <h3 className="font-display mt-2 text-2xl text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink">
          {items.length === 1
            ? `${items[0].away} at ${items[0].home}`
            : items.map((t) => shortPick(t.selection, t.marketType)).join(" + ")}
        </p>
      </div>
      <Button className="w-full" size="lg" onClick={onLock} disabled={Boolean(blocked)}>
        Lock live number and save to Log
      </Button>
      {error ? <p className="text-sm text-down">{error}</p> : null}
    </div>
  );
}

export function LockedStamp({ ticket }: { ticket: PaperTicket }) {
  const payout = ticket.price != null ? profitOnStake(ticket.stake, ticket.price) : null;
  const tickets = useDeskStore((s) => s.paperTickets);
  const pulse = selectTicketPulse({ paperTickets: tickets });
  return (
    <section className="paper-card overflow-hidden p-5 text-center ring-2 ring-gold">
      <p className="stamp mt-2 text-emerald-500">On Log · waiting</p>
      <h2 className="font-display mt-2 text-2xl text-ink">{ticket.description}</h2>
      <Link
        to="/ticket"
        className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-500 px-5 text-base font-medium text-zinc-950"
      >
        See it on My Action
      </Link>
    </section>
  );
}

export function TicketChip() {
  const tickets = useDeskStore((s) => s.paperTickets);
  const pulse = selectTicketPulse({ paperTickets: tickets });
  const pathnameOpen = pulse.openCount > 0;
  return (
    <Link
      to="/ticket"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium",
        pathnameOpen ? "ticket-pulse bg-wash-gold text-emerald-500" : "text-muted hover:bg-wash hover:text-ink",
      )}
    >
      <span className="grid size-6 place-items-center rounded-sm bg-emerald-500 font-mono text-xs text-zinc-950">
        {pulse.openCount}
      </span>
      <span className="hidden sm:inline">{pulse.openCount === 1 ? "open ticket" : "open tickets"}</span>
      <span className="sm:hidden">open</span>
    </Link>
  );
}

export function buildLockPayload(
  items: ParsedTicket[],
  rows: ScanRow[],
  stake: number,
): Omit<PaperTicket, "id" | "createdAt" | "venue" | "status"> {
  const delayed = items.map((t) => delayedMatch(rows, t));
  const livePrices = items.map((t) => t.price);
  const decimal = product(livePrices.map((p) => americanToDecimal(p)));
  const price = items.length === 1 ? items[0].price : decimalToAmerican(decimal);
  const delayedPrice = delayed[0]?.price;
  const fairs = items.map((_, i) => delayed[i]?.fairProb).filter((p): p is number => p != null && Number.isFinite(p));
  const chance = items.length > 1 ? (fairs.length === items.length ? product(fairs) : undefined) : delayed[0]?.fairProb;
  const desc =
    items.length === 1
      ? `${shortPick(items[0].selection, items[0].marketType)} · ${items[0].away} at ${items[0].home}`
      : items.map((t) => shortPick(t.selection, t.marketType)).join(" + ");
  return {
    kind: items.length > 1 ? "parlay" : items[0].marketType === "prop" ? "prop" : "main",
    description: desc,
    stake,
    price,
    postedPrice: delayedPrice ?? price,
    delayedPrice,
    livePrice: price,
    chance,
    gameIds: delayed.filter(Boolean).map((r) => r!.eventId),
    home: items[0].home,
    away: items[0].away,
  };
}

export function useStake() {
  return useDeskStore(selectUnit);
}
