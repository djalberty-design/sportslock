import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import type { CrossCheck, PlayBoard } from "@/lib/market/types";
import { USED_LABEL, LANE_COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useDeskStore } from "@/lib/desk-store";
import { Button } from "@/components/ui/button";
import { EventWhen } from "./event-when";
import { WagerMeter } from "./wager-meter";

const USED_TONE: Record<CrossCheck["used"], string> = {
  blocks: "text-down",
  supports: "text-up",
  noted: "text-emerald-500",
  discarded: "text-faint",
};

export function OpinionCard({ board, compact = false }: { board: PlayBoard; compact?: boolean }) {
  const { verdict } = board;
  const [open, setOpen] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const ignoreRibbon = useDeskStore((s) => s.ignoreRibbon);
  const setIgnoreRibbon = useDeskStore((s) => s.setIgnoreRibbon);
  const lane = LANE_COPY[verdict.lane];
  const rec = board[verdict.lane];
  const stops = verdict.checks.filter((c) => c.used === "blocks").length;
  const oks = verdict.checks.filter((c) => c.used === "supports").length;

  return (
    <section className="paper-card relative overflow-hidden p-5 md:p-6">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" aria-hidden="true" />
      <p className="stamp text-emerald-500">The call · {lane.kicker}</p>
      <h2 className="font-display mt-2 text-2xl text-ink md:text-[1.7rem]">{lane.name}</h2>
      <p className="mt-4 text-sm uppercase tracking-[0.14em] text-muted">Do this</p>
      <p className="mt-1 font-display text-xl text-ink">{verdict.doThis}</p>
      {compact && rec ? (
        <p className="mt-3 text-sm text-emerald-500">
          {rec.kickoffEnglish || "Time TBA"}
          {rec.away && rec.home ? ` · ${rec.away} (away) at ${rec.home} (home)` : ""}
        </p>
      ) : rec ? (
        <EventWhen play={rec} />
      ) : null}
      {rec ? (
        <WagerMeter
          className="mt-4"
          size={compact ? "md" : "lg"}
          chance={rec.combinedFair ?? rec.fairProb}
          price={rec.price}
          decimalPayout={rec.decimalPayout}
          label={rec.combinedFair != null ? "Chance they all hit" : "Chance it hits"}
        />
      ) : null}
      {compact ? (
        rec?.eventId ? (
          <Link
            to="/game/$eventId"
            params={{ eventId: rec.eventId }}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
          >
            Bet this one game — photo required
          </Link>
        ) : (
          <p className="mt-4 text-sm text-muted">{verdict.because}</p>
        )
      ) : (
        <>
      <p className="mt-4 text-sm uppercase tracking-[0.14em] text-muted">Why</p>
      <p className="mt-1 text-base text-ink/90">{verdict.because}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted">Where</dt>
          <dd className="font-medium text-ink">{verdict.venue}</dd>
        </div>
        <div>
          <dt className="text-muted">Confidence</dt>
          <dd className="font-medium capitalize">{verdict.conviction}</dd>
        </div>
        <div>
          <dt className="text-muted">Choice</dt>
          <dd className="font-medium">{lane.name}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-md bg-wash px-3 text-left text-sm text-ink"
          onClick={() => setShowChecks((v) => !v)}
        >
          <span>
            We ran 11 checks · {oks} OK · {stops} stop
          </span>
          <span className="stamp text-emerald-500">{showChecks ? "Hide" : "Show"}</span>
        </button>
        {showChecks ? (
          <ol className="mt-3 grid gap-1.5">
            {verdict.checks.map((c, i) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <span className="font-mono w-5 text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-28 font-medium text-ink">{c.label}</span>
                <span className={cn("min-w-16 stamp", USED_TONE[c.used])}>{USED_LABEL[c.used]}</span>
                <span className="text-muted">{c.finding}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide the longer why" : "Longer why"}
        </Button>
        <Link to="/learn" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-emerald-500 underline-offset-4 hover:underline">
          Open Learn
        </Link>
        <Button variant="outline" size="sm" onClick={() => setIgnoreRibbon(!ignoreRibbon)}>
          {ignoreRibbon ? "Show today's badge" : "Hide badge for this board"}
        </Button>
      </div>
      {open ? (
        <div className="mt-4 rounded-md bg-wash p-4 text-sm text-ink">
          <p>{verdict.learnMore}</p>
          <p className="mt-2 text-muted">
            {BRAND.purpose} Delay always blocks auto-betting. You click Bet at {BRAND.venueLive} — or you don't.
          </p>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
