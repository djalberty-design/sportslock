import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortPick } from "@/lib/copy";
import { useDeskStore } from "@/lib/desk-store";
import { payoutMultiple } from "@/lib/market/engine";
import {
  assembleChanceInput,
  gradeParlay,
  leanEnglish,
  predictFor,
  researchedFavorite,
  type EventResearch,
} from "@/lib/market/research";
import { buildChance } from "@/lib/market/chance";
import { getEventResearch } from "@/lib/market/server";
import type { QuoteLine, ScanRow } from "@/lib/market/types";
import { useDeskDecision } from "@/lib/market/use-board";
import { shownCombinedChance } from "@/lib/market/calibrate";
import type { ParlayPick } from "@/lib/market/picks";
import { WagerMeter } from "./wager-meter";
import { HardRockSheet } from "./hard-rock-sheet";
import { LiveBanner } from "./live-stamp";

export function GamePage({ eventId }: { eventId: string }) {
  const { scan, snapshot } = useDeskDecision();
  const addParlayLeg = useDeskStore((s) => s.addParlayLeg);
  const removeParlayLeg = useDeskStore((s) => s.removeParlayLeg);
  const legs = useDeskStore((s) => s.parlayLegs);
  const [wager, setWager] = useState<ScanRow | null>(null);
  const rows = (scan?.rows ?? []).filter((r) => r.eventId === eventId);
  const quote = snapshot?.quotes.find((q) => q.eventId === eventId);
  const first: ScanRow | QuoteLine | undefined = rows[0] ?? quote;
  const brief = snapshot?.briefs?.find((b) => b.eventId === eventId);
  const q = useQuery({
    queryKey: ["research", eventId],
    queryFn: () => getEventResearch({ data: { eventId } }),
    enabled: Boolean(eventId),
    staleTime: 120_000,
  });
  const research: EventResearch | null = q.data && q.data.ok ? q.data.research : null;
  const home = first?.home ?? research?.home ?? "Home";
  const away = first?.away ?? research?.away ?? "Away";
  const start = first?.start ?? research?.start ?? "";
  const sport = (first && "sport" in first ? first.sport : research?.sport) ?? "";
  const mlHome = rows.find((r) => r.marketType === "ml" && r.side === "home");
  const espnHome = research?.espnHomeWin ?? brief?.espnHomeWin;
  const predict = predictFor(snapshot?.predict, eventId);
  const report = buildChance(
    assembleChanceInput({
      rows,
      brief,
      research: research ?? undefined,
      predict,
      home,
      away,
      extra: {
        ticketHome: brief?.ticketHome ?? snapshot?.publicSplits.find((s) => s.eventId === eventId)?.ticketPct,
        handleHome: brief?.handleHome ?? snapshot?.publicSplits.find((s) => s.eventId === eventId)?.handlePct,
        steam: brief?.steam ?? snapshot?.publicSplits.find((s) => s.eventId === eventId)?.steam,
      },
    }),
  );
  const fav = report
    ? {
        side: report.favorite,
        name: report.favoriteName,
        chance: report.chance,
        homeChance: report.home,
        report,
      }
    : researchedFavorite(rows, brief, { home, away });
  const lean = leanEnglish({
    home,
    away,
    oddsHome: mlHome?.fairProb,
    espnHome,
    ensembleHome: fav?.homeChance,
    crowdHome: report?.crowdHome ?? predict?.kalshiHome ?? predict?.polyHome,
  });
  const liveWager =
    wager && scan
      ? (scan.rows.find(
          (r) => r.eventId === wager.eventId && r.marketType === wager.marketType && r.side === wager.side,
        ) ?? wager)
      : wager;

  function pickOneGame(row: ScanRow) {
    setWager(row);
  }

  if (!first && !q.isLoading) {
    return (
      <div className="space-y-4">
        <Link to="/board" className="inline-flex min-h-11 items-center gap-1 text-sm text-gold">
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          Games
        </Link>
        <p className="text-ink">That game is not on the live board.</p>
      </div>
    );
  }

  const researchPanel: ReactNode = (
    <div className="space-y-4">
      <section className="paper-card p-5">
        <p className="stamp text-gold">Who is more likely to win?</p>
        <h2 className="font-display mt-2 text-2xl text-ink">{lean.title}</h2>
        <p className="mt-2 text-sm text-ink/90">{lean.because}</p>
        {fav ? (
          <WagerMeter
            className="mt-4"
            size="lg"
            chance={fav.chance}
            price={rows.find((r) => r.marketType === "ml" && r.side === fav.side)?.price ?? mlHome?.price}
            label={`${fav.name} to win`}
          />
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChanceBar label="Sportsbook (cut removed)" home={home} away={away} homeP={mlHome?.fairProb} />
          <ChanceBar
            label="Kalshi prediction market"
            home={home}
            away={away}
            homeP={predict?.kalshiHome ?? brief?.kalshiHomeWin}
          />
          <ChanceBar label="Polymarket" home={home} away={away} homeP={predict?.polyHome ?? brief?.polyHomeWin} />
          <ChanceBar label="ESPN matchup model" home={home} away={away} homeP={espnHome} />
          <ChanceBar label="Full ensemble" home={home} away={away} homeP={fav?.homeChance} />
          <ChanceBar
            label="Ticket count (bets %)"
            home={home}
            away={away}
            homeP={brief?.ticketHome ?? rows.find((r) => r.marketType === "ml" && r.side === "home")?.ticketPct}
          />
          <ChanceBar
            label="Handle (money %)"
            home={home}
            away={away}
            homeP={brief?.handleHome ?? rows.find((r) => r.marketType === "ml" && r.side === "home")?.handlePct}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          {report?.because ??
            "Looks are pooled in log-odds. Ticket count vs handle is a layer â€” we never copy 80% of bets. Kalshi and Polymarket are research, not a Hard Rock ticket. This is not a lock."}
        </p>
        <p className="mt-1 text-xs text-gold">
          Confidence {report?.confidence ?? "low"}
          {report ? ` Â· ${report.layers.length} looks Â· agreement ${Math.round(report.agreement * 100)} in 100` : ""}
        </p>
      </section>

      {q.isLoading ? <p className="text-sm text-muted">Loading injuries, form, and the ESPN modelâ€¦</p> : null}
      {q.data && !q.data.ok ? <p className="text-sm text-down">{q.data.error}</p> : null}

      {research?.pitchers.length ? (
        <section className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">Starting pitchers</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {research.pitchers.map((p) => (
              <li key={p.team}>
                <span className="text-muted">{p.team}: </span>
                {p.line}
              </li>
            ))}
          </ul>
        </section>
      ) : quote?.homePitcher || quote?.awayPitcher ? (
        <section className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">Starting pitchers</h2>
          <p className="mt-2 text-sm">Away: {quote?.awayPitcher ?? "TBA"}</p>
          <p className="text-sm">Home: {quote?.homePitcher ?? "TBA"}</p>
        </section>
      ) : null}

      {research?.lastFive.length ? (
        <section className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">Last five games</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {research.lastFive.map((b) => (
              <li key={b.team}>
                <p className="font-medium">{b.team}</p>
                <p className="font-mono text-gold">{b.results.join(" ")}</p>
                <p className="text-muted">{b.line}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {research?.injuries.length ? (
        <section className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">Injuries and listings</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {research.injuries.map((inj, i) => (
              <li key={`${inj.player}-${i}`}>
                <span className="text-gold">{inj.status}</span>
                {" Â· "}
                <span className="font-medium">{inj.player}</span>
                <span className="text-muted"> ({inj.team})</span>
                {inj.detail ? <span className="text-muted"> Â· {inj.detail}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {research?.series ? <p className="text-sm text-ink">Series: {research.series}</p> : null}

      {research?.headlines.length ? (
        <section className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">Headlines (context only)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/90">
            {research.headlines.map((h) => (
              <li key={h.title}>{h.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted">{research?.note ?? "Research, not a promise. Confirm every live number at Hard Rock Bet."}</p>
    </div>
  );

  const eventLegs = legs.filter((l) => l.eventId === eventId);
  const sgpGrade = eventLegs.length >= 2 ? gradeParlay(eventLegs) : null;
  const showSlip = Boolean(liveWager) || Boolean(sgpGrade);

  return (
    <div className={showSlip ? "space-y-4 pb-40" : "space-y-4"}>
      <Link to="/board" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-gold">
        <ChevronLeft className="size-4" strokeWidth={1.75} />
        Games
      </Link>

      <LiveBanner row={first && "inPlay" in first ? first : rows[0]} />

      <HardRockSheet
        sport={sport}
        home={home}
        away={away}
        homeAbbr={first && "homeAbbr" in first ? first.homeAbbr : undefined}
        awayAbbr={first && "awayAbbr" in first ? first.awayAbbr : undefined}
        homeLogo={first && "homeLogo" in first ? first.homeLogo : undefined}
        awayLogo={first && "awayLogo" in first ? first.awayLogo : undefined}
        start={start}
        phase={first && "phase" in first ? first.phase : undefined}
        scheduleOnly={first && "scheduleOnly" in first ? first.scheduleOnly : undefined}
        rows={rows}
        selected={wager}
        legs={legs}
        onPick={pickOneGame}
        addLeg={addParlayLeg}
        removeLeg={removeParlayLeg}
        research={researchPanel}
        eventResearch={research}
        homeWin={report?.home ?? mlHome?.fairProb ?? 0.5}
        researchLoading={q.isLoading}
      />

      {first && "scheduleOnly" in first && first.scheduleOnly ? (
        <p className="rounded-md bg-wash-gold px-3 py-2 text-sm text-gold">
          ESPN listed this matchup but has not posted a two-way price. Fast Log when the number
          drops.
        </p>
      ) : null}

      {sgpGrade ? (
        <section id="one-game-wager" className="fixed inset-x-0 bottom-[4.75rem] z-50 mx-auto max-w-6xl px-3">
          <SgpSlip sgpGrade={sgpGrade} eventLegs={eventLegs} />
        </section>
      ) : liveWager ? (
        <section id="one-game-wager" className="fixed inset-x-0 bottom-[4.75rem] z-50 mx-auto max-w-6xl px-3">
          <BetSlip row={liveWager} onCancel={() => setWager(null)} />
        </section>
      ) : null}

      {!liveWager && !sgpGrade ? (
        <p className="px-1 text-sm text-muted">
          Tap a number — same layout as the book. Every cell already shows chance it hits and what you collect.
        </p>
      ) : null}
    </div>
  );
}

function BetSlip({ row, onCancel }: { row: ScanRow; onCancel: () => void }) {
  const [stake, setStake] = useState(5);
  const placePaperTicket = useDeskStore((s) => s.placePaperTicket);
  const price = row.price ?? -110;
  const multi = payoutMultiple(price);
  const toWin = stake * (multi - 1);

  const handleLock = () => {
    placePaperTicket({
      kind: "main",
      description: `${row.selection} ${row.marketType.toUpperCase()} (${price})`,
      stake,
      price,
      status: "open",
      fastLog: true,
      legs: [
        {
          eventId: row.eventId,
          sport: row.sport,
          start: row.start,
          home: row.home,
          away: row.away,
          marketType: row.marketType,
          selection: row.selection,
          side: row.side,
          price,
          status: "open"
        }
      ]
    });
    onCancel();
  };

  return (
    <div className="rounded-xl bg-panel p-4 shadow-2xl border border-panel-border text-ink ring-1 ring-neon/20">
      <div className="flex justify-between items-end border-b border-panel-border pb-2 mb-4">
        <div>
          <p className="text-xs text-muted font-bold uppercase">{row.sport} • {row.marketType}</p>
          <p className="text-lg font-bold">{row.selection}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-mono-numbers text-neon">{price > 0 ? `+${price}` : price}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <label className="text-xs text-muted font-bold uppercase">Wager</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input 
              type="number" 
              value={stake} 
              onChange={(e) => setStake(Number(e.target.value))}
              className="w-full rounded-md bg-obsidian border border-panel-border py-2 pl-7 pr-3 font-mono-numbers text-ink focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
            />
          </div>
        </div>
        <div className="flex-1 text-right">
          <label className="text-xs text-muted font-bold uppercase">To Win</label>
          <p className="mt-2 text-xl font-mono-numbers text-ink">${toWin.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleLock}
          className="flex-1 flex min-h-12 items-center justify-center rounded-lg bg-neon text-obsidian font-bold text-lg hover:bg-neon/90 transition-colors shadow-[0_0_15px_rgba(57,255,20,0.4)]"
        >
          Lock It
        </button>
        <button 
          onClick={onCancel}
          className="px-4 min-h-12 rounded-lg border border-panel-border text-muted hover:text-ink hover:bg-panel-border transition-colors font-bold uppercase text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SgpSlip({ 
  sgpGrade, 
  eventLegs,
}: { 
  sgpGrade: ReturnType<typeof gradeParlay>; 
  eventLegs: ParlayPick[]; 
}) {
  const [stake, setStake] = useState(5);
  const placePaperTicket = useDeskStore((s) => s.placePaperTicket);
  const removeParlayLeg = useDeskStore((s) => s.removeParlayLeg);
  const price = sgpGrade.americanPayout;
  const multi = sgpGrade.decimalPayout;
  const toWin = stake * (multi - 1);

  const handleLock = () => {
    placePaperTicket({
      kind: "parlay",
      description: `Same Game Parlay (${eventLegs.length} legs) (${price > 0 ? '+' : ''}${price})`,
      stake,
      price,
      status: "open",
      fastLog: true,
      legs: eventLegs.map(l => ({
        eventId: l.eventId,
        sport: l.sport,
        start: l.start,
        home: l.home,
        away: l.away,
        marketType: l.marketType,
        selection: l.selection,
        side: l.side,
        price: l.price,
        status: "open"
      }))
    });
    eventLegs.forEach(l => removeParlayLeg(l.key || l.selection));
  };

  const handleCancel = () => {
    eventLegs.forEach(l => removeParlayLeg(l.key || l.selection));
  };

  return (
    <div className="rounded-xl bg-panel p-4 shadow-2xl border border-panel-border text-ink ring-1 ring-neon/20">
      <div className="flex justify-between items-end border-b border-panel-border pb-2 mb-4">
        <div>
          <p className="text-xs text-muted font-bold uppercase">Same Game Parlay • {eventLegs.length} Legs</p>
          <p className="text-lg font-bold">Combined Odds</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-mono-numbers text-neon">{price > 0 ? `+${price}` : price}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <label className="text-xs text-muted font-bold uppercase">Wager</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input 
              type="number" 
              value={stake} 
              onChange={(e) => setStake(Number(e.target.value))}
              className="w-full rounded-md bg-obsidian border border-panel-border py-2 pl-7 pr-3 font-mono-numbers text-ink focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
            />
          </div>
        </div>
        <div className="flex-1 text-right">
          <label className="text-xs text-muted font-bold uppercase">To Win</label>
          <p className="mt-2 text-xl font-mono-numbers text-ink">${toWin.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleLock}
          className="flex-1 flex min-h-12 items-center justify-center rounded-lg bg-neon text-obsidian font-bold text-lg hover:bg-neon/90 transition-colors shadow-[0_0_15px_rgba(57,255,20,0.4)]"
        >
          Lock It
        </button>
        <button 
          onClick={handleCancel}
          className="px-4 min-h-12 rounded-lg border border-panel-border text-muted hover:text-ink hover:bg-panel-border transition-colors font-bold uppercase text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ChanceBar({
  label,
  home,
  away,
  homeP,
}: {
  label: string;
  home: string;
  away: string;
  homeP?: number;
}) {
  if (homeP == null || !Number.isFinite(homeP)) {
    return (
      <div className="rounded-md bg-wash px-3 py-3 text-sm">
        <p className="text-muted">{label}</p>
        <p className="mt-1 text-ink">Not posted yet</p>
      </div>
    );
  }
  const h = Math.round(homeP * 100);
  const a = 100 - h;
  return (
    <div className="rounded-md bg-wash px-3 py-3 text-sm">
      <p className="text-muted">{label}</p>
      <p className="mt-2 flex justify-between text-xs">
        <span>
          {away} {a}%
        </span>
        <span>
          {home} {h}%
        </span>
      </p>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-navy-deep">
        <span className="bg-ink/40" style={{ width: `${a}%` }} />
        <span className="bg-gold" style={{ width: `${h}%` }} />
      </div>
    </div>
  );
}
