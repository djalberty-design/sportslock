// @ts-nocheck
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatChancePct, formatBetUsd } from "@/lib/copy";
import { Camera, Copy, EyeOff, Pin } from "lucide-react";
import { feeBadge, timingKind, TIMING_COPY } from "@/lib/market/edge";
import { belowSixty, candidateToPicks, highestTodayLabel, qualityBand, type DeskPick } from "@/lib/market/picks";
import { lookChipId, LOOK_LABEL, tapeChip, type ChipId } from "@/lib/plain-words";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { useAccess } from "@/lib/use-access";
import { hidePickRemote, saveDeskSettings } from "@/lib/desk-api";
import { useDeskDecision } from "@/lib/market/use-board";
import { useQueryClient } from "@tanstack/react-query";
import type { PaperTicket, ParsedTicket } from "@/lib/market/types";
import { cn, formatKickoff } from "@/lib/utils";
import { WordSheet } from "./word-sheet";
import { LiveStamp } from "./live-stamp";
import { FastLogModal } from "./fast-log-modal";
import { QuantFactorWaterfall } from "./quant-factor-waterfall";
import {
  formatAmerican,
  formatLineAge,
  toPickCardView,
} from "@/lib/market/pick-card-contract";

export function PickCard({
  pick,
  featured = false,
  rank,
  isSelected,
  onToggle,
}: {
  pick: DeskPick;
  featured?: boolean;
  rank?: number;
  isSelected?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
}) {
  const [fastLogOpen, setFastLogOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const unit = useDeskStore(selectUnit);
  const bankroll = useDeskStore((s) => s.liveBankroll);
  const setParlayLegs = useDeskStore((s) => s.setParlayLegs);
  const { isAdmin, signedIn } = useAccess();
  const { settings } = useDeskDecision();
  const qc = useQueryClient();
  const hidePick = useDeskStore((s) => s.hidePick);
  const pinPick = useDeskStore((s) => s.pinPick);
  const pinned = settings.pinnedPickId === pick.id;
  const row = pick.row;
  const view = toPickCardView(pick, {
    bankroll: bankroll > 0 ? bankroll : 200,
    unit: unit > 0 ? unit : 20,
  });
  const priceLabel = formatAmerican(view.price);
  const edgeLabel = view.edgePct == null ? "—" : `${view.edgePct > 0 ? "+" : ""}${view.edgePct}%`;
  const stakeLabel = view.kellyStake == null ? "Set bankroll" : formatBetUsd(view.kellyStake);

  async function copyTicket(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(view.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={cn("paper-card relative p-4", pick.row?.inPlay ? "ring-2 ring-red-500" : featured || isSelected ? "ring-2 ring-neon" : "")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="stamp text-muted">
            {view.sport}
            {rank ? ` · ${rank}` : ""}
            {pick.parlay ? ` · ${pick.parlay.legs.length}-leg` : ""}
            {view.sameGame ? " · same-game" : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{view.matchup}</p>
          <h3 className="font-display mt-1 text-xl text-ink">{view.pick}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            ●{view.confidenceGrade}
          </p>
          <p className="text-xs text-muted mt-1">{formatLineAge(view.lineAgeSeconds)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-panel px-2 py-2">
          <p className="stamp text-muted">{view.book}</p>
          <p className="font-display mt-1 text-lg tabular-nums text-ink">{priceLabel}</p>
        </div>
        <div className="rounded-md bg-panel px-2 py-2">
          <p className="stamp text-muted">Edge</p>
          <p className="font-display mt-1 text-lg tabular-nums text-neon">{edgeLabel}</p>
        </div>
        <div className="rounded-md bg-panel px-2 py-2">
          <p className="stamp text-muted">Bet</p>
          <p className="font-display mt-1 text-lg tabular-nums text-ink">{stakeLabel}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyTicket}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-panel px-3 text-sm font-medium text-ink"
        >
          <Copy className="size-3.5" />
          {copied ? "Copied" : "Copy ticket"}
        </button>
        {signedIn ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (pick.parlay) setParlayLegs(candidateToPicks(pick.parlay, []));
              setFastLogOpen(true);
            }}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-neon/10 px-3 text-sm font-medium text-neon ring-1 ring-inset ring-neon/20"
          >
            <Camera className="size-3.5" />
            Photo lock
          </button>
        ) : (
          <Link
            to="/login"
            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md bg-neon/10 px-3 text-sm font-medium text-neon ring-1 ring-inset ring-neon/20"
          >
            Sign in to lock
          </Link>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWhyOpen((v) => !v);
          }}
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-panel px-3 text-sm font-medium text-muted"
        >
          Why
        </button>
      </div>

      {whyOpen ? (
        <div className="mt-4 border-t border-line/60 pt-3 space-y-3">
          <LiveStamp row={pick.row} className="block" />
          {pick.start && !pick.row?.inPlay ? (
            <p className="text-xs text-muted">{formatKickoff(pick.start, true)}</p>
          ) : null}
          {pick.implied != null ? <EdgeRow pick={pick} /> : null}
          {view.sameGame ? (
            <p className="text-xs text-muted">
              Same-game correlation is provisional — not fit from graded SGP tape.
            </p>
          ) : null}
          {pick.why ? <p className="text-sm text-ink/85">{pick.why}</p> : null}
          {row?.waterfall ? <QuantFactorWaterfall waterfall={row.waterfall} compact={true} /> : null}
          <ConfidenceChips pick={pick} showCall={featured} />
          <FeeTimingRow pick={pick} />
          {isAdmin ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  pinPick(pick.id);
                  void saveDeskSettings({ data: { pinnedPickId: pinned ? null : pick.id } }).then((s) => {
                    qc.setQueryData(["desk-settings"], s);
                  });
                }}
                className={cn(
                  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-panel px-3 text-sm font-medium text-muted",
                  pinned && "text-neon",
                )}
              >
                <Pin className="size-4" strokeWidth={1.75} />
                {pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                onClick={() => {
                  hidePick(pick.id);
                  void hidePickRemote({ data: { pickId: pick.id, hide: true } }).then((ids) => {
                    qc.setQueryData(["desk-hidden"], ids);
                  });
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-panel px-3 text-sm font-medium text-muted"
              >
                <EyeOff className="size-4" strokeWidth={1.75} />
                Hide
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {onToggle ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle(e);
          }}
          className={cn(
            "absolute top-3 left-3 flex size-5 items-center justify-center rounded-full border border-neon/50 bg-obsidian text-neon",
            isSelected && "bg-neon text-obsidian",
          )}
        >
          {isSelected ? "✓" : "+"}
        </button>
      ) : null}

      {fastLogOpen && <FastLogModal item={pick} onClose={() => setFastLogOpen(false)} />}
    </article>
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
  if (edge != null && Math.abs(edge) >= 0.008) {
    const pts = Math.round(edge * 100);
    chips.push({
      id: edge > 0 ? "edge-up" : "edge-down",
      label: edge > 0 ? `+${pts} pts vs book` : `${pts} pts vs book`,
      tone: edge > 0 ? "up" : "muted",
    });
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
        <MiniStat label="Book" value={formatChancePct(pick.implied) ?? "—"} neon={false} />
        <MiniStat label="Desk" value={formatChancePct(pick.chance) ?? "—"} neon />
        <MiniStat
          label="Edge"
          value={
            pick.edge == null ? "—" : `${pick.edge > 0 ? "+" : ""}${Math.round(pick.edge * 100)} pts`
          }
          neon={false}
        />
      </div>
      <p className="mt-2 text-xs text-muted">Book = price implied. Desk = our chance. Edge = the gap.</p>
    </div>
  );
}

function MiniStat({ label, value, neon = false }: { label: string; value: string; neon: boolean }) {
  return (
    <div className="rounded-md bg-panel px-2 py-2 text-center">
      <p className="stamp text-muted">{label}</p>
      <p className={cn("font-display mt-1 text-lg tabular-nums", neon ? "text-neon" : "text-ink")}>{value}</p>
    </div>
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
