// @ts-nocheck
import { useState } from "react";
import { formatChancePct } from "@/lib/copy";
import { feeBadge, timingKind, TIMING_COPY } from "@/lib/market/edge";
import { espnLogoUrl } from "@/lib/market/logos";
import { belowSixty, highestTodayLabel, qualityBand, type DeskPick } from "@/lib/market/picks";
import { lookChipId, LOOK_LABEL, tapeChip, type ChipId } from "@/lib/plain-words";
import { useDeskStore } from "@/lib/desk-store";
import type { PaperTicket, ParsedTicket } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { WordSheet } from "./word-sheet";

export function CallRibbon() {
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
  const chips: { id: ChipId; label: string; tone: "neon" | "muted" | "up" }[] = [];
  if (showCall) chips.push({ id: "the-call", label: "The Call", tone: "neon" });
  if (pick.safestFallback) {
    chips.push({ id: "highest-today", label: highestTodayLabel(pick), tone: "neon" });
  } else if (belowSixty(pick)) {
    chips.push({ id: "under-60", label: "Under 60%", tone: "muted" });
  }
  chips.push({ id: lookChipId(band), label: LOOK_LABEL[band], tone: "neon" });
  chips.push({ id: tape.id, label: tape.label, tone: "muted" });
  if (!fromUserPhoto && tape.id !== "research") {
    chips.push({ id: "photo-needed", label: "Fast Log to lock this price", tone: "muted" });
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
    chips.push({ id: "early-mover", label: "Early Mover Advantage", tone: "neon" });
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
              "rounded-sm bg-panel px-2 py-1 text-left text-xs tracking-wide",
              c.tone === "neon" ? "text-neon" : c.tone === "up" ? "text-up" : "text-muted",
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
        <MiniStat label="Desk" value={formatChancePct(pick.chance) ?? "—"} neon/>
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

function MiniStat({ label, value, neon= false }: { label: string; value: string; neon: boolean }) {
  return (
    <div className="rounded-md bg-panel px-2 py-2 text-center">
      <p className="stamp text-muted">{label}</p>
      <p className={cn("font-display mt-1 text-lg tabular-nums", neon? "text-neon" : "text-ink")}>{value}</p>
    </div>
  );
}

export function TeamMarks({ pick }: { pick: DeskPick }) {
  if (pick.parlay) return <span className="stamp text-muted">{pick.parlay.legs.length} legs</span>;
  const home = pick.homeLogo || (pick.homeAbbr ? espnLogoUrl(pick.sport, pick.homeAbbr) : undefined);
  const away = pick.awayLogo || (pick.awayAbbr ? espnLogoUrl(pick.sport, pick.awayAbbr) : undefined);
  if (!home && !away) return null;
  return (
    <span className="flex -space-x-2">
      {away ? <img src={away} alt="" className="size-8 rounded-full bg-panel object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
      {home ? <img src={home} alt="" className="size-8 rounded-full bg-panel object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
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

export function FeeTimingRow({ pick }: { pick: DeskPick }) {
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
          className={cn("rounded-sm bg-panel px-2 py-1 text-xs", fee.tone === "avoid" ? "text-down" : fee.tone === "high" ? "text-neon" : "text-muted")}
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
          className="rounded-sm bg-neon/10 px-2 py-1 text-xs text-neon"
        >
          {TIMING_COPY[kind].title}
        </button>
      ) : null}
      <WordSheet id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
