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
