// @ts-nocheck
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { useDeskDecision } from "@/lib/market/use-board";
import { emptyLeg, parsedFromDeskPick, parsedFromRow, readyLegs } from "@/lib/market/manual-lock";
import type { DeskPick } from "@/lib/market/picks";
import type { MarketType, PaperTicket, ParsedTicket, ScanRow } from "@/lib/market/types";
import { buildLockPayload, LockedStamp, TicketReview } from "./ticket-lock";
import { cn } from "@/lib/utils";

export function HardRockConfirm({
  pick,
  row,
  heading,
  embedded = false,
}: {
  pick?: DeskPick | null;
  row?: ScanRow | null;
  heading?: string;
  embedded?: boolean;
}) {
  const seeded = useMemo(() => {
    if (pick) return parsedFromDeskPick(pick);
    if (row) return [parsedFromRow(row)];
    return [emptyLeg()];
  }, [pick, row]);
  const [legs, setLegs] = useState<ParsedTicket[]>(seeded);
  useEffect(() => {
    setLegs(seeded);
    setLocked(null);
    setError(null);
  }, [seeded]);
  const [locked, setLocked] = useState<PaperTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unit = useDeskStore(selectUnit);
  const place = useDeskStore((s) => s.placePaperTicket);
  const confirmParsed = useDeskStore((s) => s.confirmParsed);
  const { scan } = useDeskDecision();

  const ready = readyLegs(legs);
  const multi = ready.length >= 2;
  const draft = !multi ? ready[0] : undefined;

  function setLeg(i: number, patch: Partial<ParsedTicket>) {
    setLegs(legs.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  }

  function lock() {
    const items = readyLegs(legs);
    if (!items.length) {
      setError("Need the pick and the live Hard Rock odds.");
      return;
    }
    items.forEach((l) => confirmParsed({ ...l, confirmed: true, confidence: 1 }));
    const payload = buildLockPayload(items, scan?.rows ?? [], unit);
    const r = place(payload);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setLocked(r.ticket);
    setError(null);
  }

  if (locked) {
    return (
      <section id="lock-in" className={cn(embedded ? "mt-5 space-y-3" : "paper-card p-5 md:p-6")}>
        <LockedStamp ticket={locked} />
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            setLocked(null);
            setLegs(seeded);
          }}
        >
          Confirm another ticket
        </Button>
      </section>
    );
  }

  return (
    <section id="lock-in" className={cn(embedded ? "mt-5 space-y-4" : "paper-card p-5 md:p-6")}>
      <p className="stamp text-emerald-500">Hard Rock confirm</p>
      <h2 className="font-display mt-1 text-xl text-ink">
        {heading ?? (multi ? "Confirm this parlay at Hard Rock" : "Confirm this ticket at Hard Rock")}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Photo read is off for now. Fields start as what Sports Lock named. Fix the live number, add legs if it is a
        parlay, then save to Log. This site never places the bet.
      </p>

      <div className="mt-4 space-y-3">
        {legs.map((leg, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-md bg-wash p-3 md:grid-cols-3">
            <p className="col-span-2 stamp text-emerald-500 md:col-span-3">{multi || legs.length > 1 ? `Leg ${i + 1}` : "Single"}</p>
            <Field label="Sport">
              <Input value={leg.sport} onChange={(e) => setLeg(i, { sport: e.target.value })} />
            </Field>
            <Field label="Away">
              <Input value={leg.away} onChange={(e) => setLeg(i, { away: e.target.value })} />
            </Field>
            <Field label="Home">
              <Input value={leg.home} onChange={(e) => setLeg(i, { home: e.target.value })} />
            </Field>
            <Field label="Type">
              <Input
                value={leg.marketType}
                onChange={(e) => setLeg(i, { marketType: e.target.value as MarketType })}
              />
            </Field>
            <Field label="Side">
              <Input value={leg.side} onChange={(e) => setLeg(i, { side: e.target.value })} />
            </Field>
            <Field label="Odds">
              <Input inputMode="numeric" value={leg.price} onChange={(e) => setLeg(i, { price: Number(e.target.value) })} />
            </Field>
            <Field label="The pick" className="col-span-2 md:col-span-3">
              <Input value={leg.selection} onChange={(e) => setLeg(i, { selection: e.target.value })} />
            </Field>
            <Field label="Player">
              <Input value={leg.player ?? ""} onChange={(e) => setLeg(i, { player: e.target.value })} />
            </Field>
            <Field label="Line">
              <Input
                inputMode="decimal"
                value={leg.point ?? ""}
                onChange={(e) => setLeg(i, { point: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </Field>
            {legs.length > 1 ? (
              <div className="col-span-2 md:col-span-3">
                <Button variant="ghost" onClick={() => setLegs(legs.filter((_, n) => n !== i))}>
                  Remove this leg
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setLegs([...legs, emptyLeg(legs[0]?.sport ?? "NFL")])}>
          Add a leg
        </Button>
        {pick || row ? (
          <Button variant="ghost" onClick={() => setLegs(seeded)}>
            Reset to Sports Lock
          </Button>
        ) : null}
      </div>

      {ready.length ? (
        <TicketReview
          draft={draft}
          legs={multi ? ready : undefined}
          rows={scan?.rows ?? []}
          onLock={lock}
          error={error}
        />
      ) : (
        <p className="text-sm text-emerald-500">Type the pick and the live odds to save this to Log.</p>
      )}
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("text-xs text-muted", className)}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
