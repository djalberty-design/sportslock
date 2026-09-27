// @ts-nocheck
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatBetUsd, profitOnStake, sportLabel } from "@/lib/copy";
import { EyeOff, Pin } from "lucide-react";
import { candidateToPicks, pickMatchup, type DeskPick } from "@/lib/market/picks";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { useAccess } from "@/lib/use-access";
import { hidePickRemote, saveDeskSettings } from "@/lib/desk-api";
import { useDeskDecision } from "@/lib/market/use-board";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatKickoff } from "@/lib/utils";
import { HitReadout, WagerMeter, getEdgeTone } from "./wager-meter";
import { LiveStamp } from "./live-stamp";
import { FastLogModal } from "./fast-log-modal";
import { SharePickButton } from "./share-pick";
import { QuantFactorWaterfall } from "./quant-factor-waterfall";
import { WhyDrawer } from "./why-drawer";
import { PickCardHeader } from "./pick-card-header";
import { toPickCardView } from "@/lib/market/pick-card-contract";
import { CallRibbon, ConfidenceChips, EdgeRow, TeamMarks, FeeTimingRow } from "./pick-card-extras";

export { ConfidenceChips, EdgeRow } from "./pick-card-extras";

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
  const row = pick.row;
  const isSharp = row?.ticketPct != null && row?.handlePct != null && (row.handlePct - row.ticketPct >= 15);
  const card = toPickCardView(pick, { bankroll, unit });

  return (
    <article className={cn("paper-card relative p-4", (featured || pick.row?.inPlay) && "p-5 md:p-6", pick.row?.inPlay ? "ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] border-red-500 z-10" : (featured || isSelected ? "ring-2 ring-neon" : ""))}>
      <PickCardHeader card={card} />
      {isSharp && (
        <div className="absolute top-10 right-4 flex items-center gap-1.5 rounded-md bg-obsidian/90 px-2 py-1 text-xs font-bold text-neon ring-1 ring-neon/40 shadow-lg backdrop-blur-sm animate-pulse z-10">
          🔥 SHARP
        </div>
      )}
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
          <div className="flex items-center gap-2">
            {onToggle && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(e);
                }}
                className={cn("flex size-5 items-center justify-center rounded-full border border-neon/50 bg-obsidian text-neon transition-colors", isSelected && "bg-neon text-obsidian")}
              >
                {isSelected ? "✓" : "+"}
              </button>
            )}
            <p className="stamp text-neon">
            {featured ? "The Call" : rank ? `${rank}` : sportLabel(pick.sport)}
            {pick.parlay ? ` · ${pick.parlay.legs.length}-pick combo` : ""}
            {pick.parlay?.sameGame ? " · same-game combo" : ""}
          </p>
          </div>
          <TeamMarks pick={pick} />
        </div>
        <LiveStamp row={pick.row} className="mt-1 block" />
        <h3 className={cn("font-display mt-2 text-ink", featured ? "text-2xl md:text-3xl" : "text-lg")}>
          {pick.selection}
        </h3>
        <p className="mt-1 text-sm text-muted">
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
              heatTone={getEdgeTone(pick.chance, pick.decimalPayout)}
              label={pick.parlay ? "% to hit all legs" : "% to hit"}
            />
            {pick.implied != null ? <EdgeRow pick={pick} className="mt-3" /> : null}
            {profit ? (
              <p className="mt-2 text-sm text-ink">
                {formatBetUsd(unit)} to win {formatBetUsd(profit.profit)}
                {!liveFits ? " · names the ticket — This ticket is under $1 or money on Start is under $100" : ""}
              </p>
            ) : null}
          </>
        ) : pick.parlay ? (
          <>
            <WagerMeter
              className="mt-3"
              size="sm"
              chance={pick.chance}
              decimalPayout={pick.decimalPayout}
              heatTone={getEdgeTone(pick.chance, pick.decimalPayout)}
              label="% to hit all legs"
            />
            {pick.parlay?.sameGame ? (
              <p className="mt-2 text-xs text-neon">Same-game combo. They move together.</p>
            ) : null}
          </>
        ) : (
          <div className="mt-3 rounded-md bg-panel px-3 py-2">
            <HitReadout chance={pick.chance} price={pick.price} heatTone={getEdgeTone(pick.chance, pick.decimalPayout)} hero align="left" />
          </div>
        )}
        {pick.parlay ? (
          <div className="mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-neon px-3 text-sm font-bold text-obsidian shadow-[0_0_15px_rgba(57,255,20,0.4)] hover:bg-neon/90 cursor-pointer transition-colors">
            Open Combo →
          </div>
        ) : (
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFastLogOpen(true);
            }}
            className="mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-neon/10 px-3 text-sm font-medium text-neon ring-1 ring-inset ring-neon/20 hover:bg-neon/20 cursor-pointer transition-colors"
          >
            ⚡ Fast Log Ticket
          </div>
        )}
      </Link>
      <WhyDrawer>
        {pick.why ? <p className="mb-2 text-sm text-ink/85">{pick.why}</p> : null}
        <ConfidenceChips pick={pick} showCall={featured} className="mt-1" />
        {row?.waterfall && (
          <div className="mt-3">
            <QuantFactorWaterfall waterfall={row.waterfall} compact={true} />
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Hard Rock link is a sport lobby, not slip injection. This card does not place a bet.
        </p>
      </WhyDrawer>
      <div className="mt-2 flex items-center justify-between">
        <FeeTimingRow pick={pick} />
        <SharePickButton
          selection={pick.selection}
          odds={pick.price != null ? (pick.price > 0 ? `+${pick.price}` : `${pick.price}`) : ""}
          probability={Math.round((pick.chance || 0) * 100)}
          matchup={pick.home && pick.away ? `${pick.away} @ ${pick.home}` : ""}
          sport={pick.sport || ""}
        />
      </div>
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
              "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-panel px-3 text-sm font-medium text-muted hover:text-neon",
              pinned && "text-neon",
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
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-panel px-3 text-sm font-medium text-muted hover:text-neon"
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
