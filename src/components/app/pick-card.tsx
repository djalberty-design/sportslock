import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatChancePct, formatBetUsd, profitOnStake, sportLabel } from "@/lib/copy";
import { Camera, EyeOff, Pin } from "lucide-react";
import { feeBadge, timingKind, TIMING_COPY } from "@/lib/market/edge";
import { espnLogoUrl } from "@/lib/market/logos";
import { belowSixty, candidateToPicks, highestTodayLabel, pickMatchup, qualityBand, type DeskPick } from "@/lib/market/picks";
import { lookChipId, LOOK_LABEL, tapeChip, type ChipId } from "@/lib/plain-words";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { useAccess } from "@/lib/use-access";
import { hidePickRemote, saveDeskSettings } from "@/lib/desk-api";
import { useDeskDecision } from "@/lib/market/use-board";
import { useQueryClient } from "@tanstack/react-query";
import type { PaperTicket, ParsedTicket } from "@/lib/market/types";
import { cn, formatKickoff } from "@/lib/utils";
import { HitReadout, WagerMeter } from "./wager-meter";
import { WordSheet } from "./word-sheet";
import { LiveStamp } from "./live-stamp";
import { FastLogModal } from "./fast-log-modal";

export function PickCard({
  pick,
  featured = false,
  rank,
}: {
  pick: DeskPick;
  featured?: boolean;
  rank?: number;
}) {
  const [fastLogOpen, setFastLogOpen] = useState(false);
  const unit = useDeskStore(selectUnit);
  const bankroll = useDeskStore((s) => s.liveBankroll);
  const setParlayLegs = useDeskStore((s) => s.setParlayLegs);
  const { isAdmin } = useAccess();
  const { settings } = useDeskDecision();
  const qc = useQueryClient();
  const hidePick = useDeskStore((s) => s.hidePick);
  const pinPick = useDeskStore((s) => s.pinPick);
  const liveFits = bankroll >= 100 && unit >= 1;
  const profit = pick.price != null ? profitOnStake(unit, pick.price) : null;
  const pinned = settings.pinnedPickId === pick.id;
  return (
    <article className={cn("paper-card relative p-4", (featured || pick.row?.inPlay) && "p-5 md:p-6", pick.row?.inPlay ? "ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-500 z-10" : (featured ? "ring-2 ring-gold" : ""))}>
      {featured ? <CallRibbon /> : null}
      <Link
        to="/ticket"
        search={{ id: pick.id }}
        onClick={() => {
          if (pick.parlay) setParlayLegs(candidateToPicks(pick.parlay, []));
        }}
        className="block"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="stamp text-gold">
            {featured ? "The Call" : rank ? `${rank}` : sportLabel(pick.sport)}
            {pick.parlay ? ` · ${pick.parlay.legs.length}-pick combo` : ""}
            {pick.parlay?.sameGame ? " · same-game combo" : ""}
          </p>
          <TeamMarks pick={pick} />
        </div>
        <LiveStamp row={pick.row} className="mt-1 block" />
        <h3 className={cn("font-display mt-2 text-ink", featured ? "text-2xl md:text-3xl" : "text-lg")}>
          {pick.selection}
        </h3>
        <p className="mt-1 text-sm text-gold">
          {pick.start && !pick.row?.inPlay ? formatKickoff(pick.start, true) : ""}
          {pick.away && pick.home ? ` · ${pickMatchup(pick)}` : ""}
        </p>
        {featured ? (
          <>
            <WagerMeter
              className="mt-3"
              size="lg"
              chance={pick.chance}
              price={pick.price}
              decimalPayout={pick.decimalPayout}
              label={pick.parlay ? "Chance they all hit" : "Chance it hits"}
            />
            {pick.implied != null ? <EdgeRow pick={pick} className="mt-3" /> : null}
            {profit ? (
              <p className="mt-2 text-sm text-ink">
                {formatBetUsd(unit)} to win {formatBetUsd(profit.profit)}
                {!liveFits ? " · names the ticket — This ticket is under $1 or money on Start is under $100" : ""}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-ink/85">{pick.why}</p>
          </>
        ) : pick.parlay ? (
          <>
            <WagerMeter
              className="mt-3"
              size="sm"
              chance={pick.chance}
              decimalPayout={pick.decimalPayout}
              label="Chance they all hit"
            />
            {pick.parlay?.sameGame ? (
              <p className="mt-2 text-xs text-gold">Same-game combo. They move together.</p>
            ) : null}
          </>
        ) : (
          <div className="mt-3 rounded-md bg-wash px-3 py-2">
            <HitReadout chance={pick.chance} price={pick.price} hero align="left" />
          </div>
        )}
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFastLogOpen(true);
          }}
          className="mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-neon/10 px-3 text-sm font-medium text-neon ring-1 ring-inset ring-neon/20 hover:bg-neon/20 cursor-pointer"
        >
          ⚡ Fast Log Ticket
        </div>
      </Link>
      <ConfidenceChips pick={pick} showCall={featured} className="mt-3" />
      <FeeTimingRow pick={pick} />
      <Link
        to="/ticket"
        search={{ id: pick.id }}
        hash="lock-in"
        onClick={() => {
          if (pick.parlay) setParlayLegs(candidateToPicks(pick.parlay, []));
        }}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-3 text-sm font-medium text-navy-deep"
      >
        <Camera className="size-4" strokeWidth={1.75} />
        Confirm with Hard Rock Photo
      </Link>
      {isAdmin ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              pinPick(pick.id);
              void saveDeskSettings({ data: { pinnedPickId: pinned ? null : pick.id } }).then((s) => {
                qc.setQueryData(["desk-settings"], s);
              });
            }}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-wash px-3 text-sm font-medium text-muted hover:text-gold",
              pinned && "text-gold",
            )}
          >
            <Pin className="size-4" strokeWidth={1.75} />
            {pinned ? "Unpin The Call" : "Pin as The Call"}
          </button>
          <button
            type="button"
            onClick={() => {
              hidePick(pick.id);
              void hidePickRemote({ data: { pickId: pick.id, hide: true } }).then((ids) => {
                qc.setQueryData(["desk-hidden"], ids);
              });
            }}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-wash px-3 text-sm font-medium text-muted hover:text-gold"
          >
            <EyeOff className="size-4" strokeWidth={1.75} />
            Hide
          </button>
        </div>
      ) : null}
      {fastLogOpen && <FastLogModal item={pick} onClose={() => setFastLogOpen(false)} />}
    </article>
  );
}

function CallRibbon() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="ticket-ribbon absolute -top-2 right-4 rounded-sm px-2 py-1 stamp"
      >
        The Call
      </button>
      <WordSheet id={open ? "the-call" : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function ConfidenceChips({
  pick,
  className,
  showCall = false,
}: {
  pick: DeskPick;
  className?: string;
  showCall?: boolean;
}) {
  const [open, setOpen] = useState<ChipId | null>(null);
  const confirmed = useDeskStore((s) => s.confirmedTickets);
  const paper = useDeskStore((s) => s.paperTickets);
  const fromUserPhoto = photoLocksThisPick(pick, confirmed, paper);
  const edge = pick.edge;
  const q = Number(pick.infoQuality);
  const qualityForBand =
    Number.isFinite(q) && q > 0
      ? q
      : pick.parlay
        ? pick.parlay.sameGame
          ? 0.62
          : pick.parlay.legs.length >= 4
            ? 0.4
            : pick.parlay.legs.length === 3
              ? 0.55
              : 0.7
        : 0;
  const band = qualityBand(qualityForBand);
  const tape = tapeChip(pick.tapeStamp, pick.researchOnly, fromUserPhoto);
  const chips: { id: ChipId; label: string; tone: "gold" | "muted" | "up" }[] = [];
  if (showCall) chips.push({ id: "the-call", label: "The Call", tone: "gold" });
  if (pick.safestFallback) {
    chips.push({ id: "highest-today", label: highestTodayLabel(pick), tone: "gold" });
  } else if (belowSixty(pick)) {
    chips.push({ id: "under-60", label: "Under 60%", tone: "muted" });
  }
  chips.push({ id: lookChipId(band), label: LOOK_LABEL[band], tone: "gold" });
  chips.push({ id: tape.id, label: tape.label, tone: "muted" });
  if (!fromUserPhoto && tape.id !== "research") {
    chips.push({ id: "photo-needed", label: "Photo to lock this price", tone: "muted" });
  }
  if (edge != null && Math.abs(edge) >= 0.008) {
    const pts = Math.round(edge * 100);
    chips.push({
      id: edge > 0 ? "edge-up" : "edge-down",
      label:
        edge > 0 ? `+${pts} pts better than the book’s chance` : `${pts} pts worse than the book’s chance`,
      tone: edge > 0 ? "up" : "muted",
    });
  }
  if (pick.row?.marketType === "ml" && pick.earlyMover) {
    chips.push({ id: "early-mover", label: "Early Mover Advantage", tone: "gold" });
  }
  const seen = new Set<string>();
  const unique = chips.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return (
    <>
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {unique.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(c.id);
            }}
            className={cn(
              "rounded-sm bg-wash px-2 py-1 text-left text-xs tracking-wide",
              c.tone === "gold" ? "text-gold" : c.tone === "up" ? "text-up" : "text-muted",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <WordSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}

export function EdgeRow({ pick, className }: { pick: DeskPick; className?: string }) {
  if (pick.implied == null) return null;
  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Book" value={formatChancePct(pick.implied) ?? "—"} />
        <MiniStat label="Desk" value={formatChancePct(pick.chance) ?? "—"} gold />
        <MiniStat
          label="Edge"
          value={
            pick.edge == null ? "—" : `${pick.edge > 0 ? "+" : ""}${Math.round(pick.edge * 100)} pts`
          }
        />
      </div>
      <p className="mt-2 text-xs text-muted">Book = what the price implies. Desk = our chance. Edge = the gap.</p>
    </div>
  );
}

function MiniStat({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-md bg-wash px-2 py-2 text-center">
      <p className="stamp text-muted">{label}</p>
      <p className={cn("font-display mt-1 text-lg tabular-nums", gold ? "text-gold" : "text-ink")}>{value}</p>
    </div>
  );
}

function TeamMarks({ pick }: { pick: DeskPick }) {
  if (pick.parlay) return <span className="stamp text-muted">{pick.parlay.legs.length} legs</span>;
  const home = pick.homeLogo || (pick.homeAbbr ? espnLogoUrl(pick.sport, pick.homeAbbr) : undefined);
  const away = pick.awayLogo || (pick.awayAbbr ? espnLogoUrl(pick.sport, pick.awayAbbr) : undefined);
  if (!home && !away) return null;
  return (
    <span className="flex -space-x-2">
      {away ? <img src={away} alt="" className="size-8 rounded-full bg-wash object-contain" /> : null}
      {home ? <img src={home} alt="" className="size-8 rounded-full bg-wash object-contain" /> : null}
    </span>
  );
}

function photoLocksThisPick(
  pick: DeskPick,
  confirmed: ParsedTicket[],
  paper: PaperTicket[],
): boolean {
  const sel = (pick.selection || "").toLowerCase();
  if (
    paper.some((t) => {
      if (pick.eventId && t.gameIds?.includes(pick.eventId)) return true;
      const d = (t.description || "").toLowerCase();
      return Boolean(sel && d && d.includes(sel.slice(0, 18)));
    })
  ) {
    return true;
  }
  if (
    confirmed.some((t) => {
      if (pick.home && pick.away && t.home === pick.home && t.away === pick.away) return true;
      const s = (t.selection || "").toLowerCase();
      return Boolean(sel && s && sel.includes(s));
    })
  ) {
    return true;
  }
  return false;
}


function FeeTimingRow({ pick }: { pick: DeskPick }) {
  const [open, setOpen] = useState<ChipId | null>(null);
  const fee = feeBadge(pick.row?.hold);
  const kind = timingKind({
    steam: pick.tapeLean === "sharp",
    tapeLean: pick.tapeLean,
    favorite: (pick.price ?? 0) < 0,
  });
  if (!fee && !kind) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {fee ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen("fee");
          }}
          className={cn("rounded-sm bg-wash px-2 py-1 text-xs", fee.tone === "avoid" ? "text-down" : fee.tone === "high" ? "text-gold" : "text-muted")}
        >
          {fee.text}
        </button>
      ) : null}
      {kind ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(kind);
          }}
          className="rounded-sm bg-wash-gold px-2 py-1 text-xs text-gold"
        >
          {TIMING_COPY[kind].title}
        </button>
      ) : null}
      <WordSheet id={open} onClose={() => setOpen(null)} />
    </div>
  );
}



