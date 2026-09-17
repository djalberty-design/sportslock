import { Link } from "@tanstack/react-router";
import type { Lane, Play, TapeLean } from "@/lib/market/types";
import { LANE_COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { EventWhen } from "./event-when";
import { WagerMeter } from "./wager-meter";

export function TapeStrip({
  ticketPct,
  handlePct,
  lean,
  note,
}: {
  ticketPct?: number;
  handlePct?: number;
  lean?: TapeLean;
  note?: string;
}) {
  if (ticketPct == null && handlePct == null) return null;
  const t = Math.round((ticketPct ?? 0) * 100);
  const h = Math.round((handlePct ?? 0) * 100);
  const label =
    lean === "sharp"
      ? "Money disagrees with the tickets"
      : lean === "public"
        ? "Public is on the tickets"
        : "Tickets and dollars agree";
  return (
    <div className="mt-3 rounded-md bg-wash px-3 py-2">
      <p className="stamp text-emerald-500">Bets vs money</p>
      <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted">Wagers (ticket count)</p>
          <p className="font-display text-lg tabular-nums text-ink">{t}%</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-deep">
            <span className="block h-full bg-ink/50" style={{ width: `${t}%` }} />
          </div>
        </div>
        <div>
          <p className="text-muted">Dollars (handle)</p>
          <p className="font-display text-lg tabular-nums text-emerald-500">{h}%</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-deep">
            <span className="block h-full bg-emerald-500" style={{ width: `${h}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/80">
        {note ? (note.replace(/\s+$/, "").replace(/\.+$/, "") + ".") : `${label}.`} Analyzed, not copied.
      </p>
    </div>
  );
}

export function PlayCard({
  play,
  recommended,
  ignore,
  rank,
  section,
}: {
  play: Play;
  recommended: Lane;
  ignore: boolean;
  rank?: number;
  section?: string;
}) {
  const ribbon = recommended === play.lane && !ignore && (!rank || rank === 1);
  const meta = LANE_COPY[play.lane];
  return (
    <article
      className={cn(
        "paper-card relative flex flex-col p-5",
        ribbon && "ring-2 ring-gold",
      )}
    >
      {ribbon ? (
        <span className="ticket-ribbon absolute -top-2 right-4 rounded-sm px-2 py-1 stamp">The call</span>
      ) : null}
      <p className="stamp text-emerald-500">{section ? `${section}${rank ? ` · ${rank}` : ""}` : meta.kicker}</p>
      <h3 className="font-display mt-2 text-xl text-ink">{meta.name}</h3>
      <p className="mt-1 text-base font-medium text-ink/90">{play.title}</p>
      <EventWhen play={play} />
      <p className="mt-2 text-sm text-ink/80">{play.action}</p>
      <WagerMeter
        className="mt-3"
        size="md"
        chance={play.combinedFair ?? play.fairProb}
        price={play.price}
        decimalPayout={play.decimalPayout}
        label={play.combinedFair != null ? "Chance they all hit" : "Chance it hits"}
      />
      <TapeStrip ticketPct={play.ticketPct} handlePct={play.handlePct} lean={play.tapeLean} note={play.tapeNote} />
      <p className="mt-3 flex-1 text-sm text-muted">{play.because}</p>
      {play.marketExplain ? <p className="mt-2 text-xs text-ink/70">{play.marketExplain}</p> : null}
      {play.details && !play.home && !play.legs?.length ? (
        <p className="mt-2 font-mono text-xs text-emerald-500">{play.details}</p>
      ) : null}
      {play.pricedAsEntertainment ? <p className="mt-2 text-sm text-emerald-500">Fun money — not a plan.</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-faint">Where to place it</dt>
          <dd className="font-medium">{play.venue}</dd>
        </div>
        <div>
          <dt className="text-faint">Confidence</dt>
          <dd className="capitalize">{play.conviction}</dd>
        </div>
        <div>
          <dt className="text-faint">OK to bet for real?</dt>
          <dd>{play.liveFits ? "Yes, after you photograph the live price" : "Research only — photograph first"}</dd>
        </div>
        <div>
          <dt className="text-faint">Type</dt>
          <dd>{meta.name}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">{meta.blurb}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {play.eventId ? (
          <Link
            to="/game/$eventId"
            params={{ eventId: play.eventId }}
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
          >
            Bet this one game
          </Link>
        ) : play.optionKind === "parlay" ? (
          <Link to="/parlay" className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline">
            Open parlay — photo required
          </Link>
        ) : (
          <Link to="/desk" className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline">
            Photograph then log
          </Link>
        )}
        <Link
          to="/option/$kind"
          params={{ kind: play.optionKind }}
          className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
        >
          What this means
        </Link>
      </div>
    </article>
  );
}