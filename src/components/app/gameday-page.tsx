import { Link } from "@tanstack/react-router";
import { useDeskDecision } from "@/lib/market/use-board";
import { pickHero, pickInSport, sortByMood, type DeskPick } from "@/lib/market/picks";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { formatBetUsd, formatChancePct, sportLabel } from "@/lib/copy";
import { coreFunSplit } from "@/lib/market/engine";
import { feeBadge, timingKind, TIMING_COPY } from "@/lib/market/edge";
import { formatAmerican, formatKickoff } from "@/lib/utils";
import { isCollegeSport } from "@/lib/market/universe";
import { Camera } from "lucide-react";

export function GamedayPage() {
  const { picks, scan, snapshot } = useDeskDecision();
  const stake = useDeskStore(selectUnit);
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const split = coreFunSplit(liveBankroll);
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const hideCollege = useDeskStore((s) => s.hideCollege);
  const hideLive = useDeskStore((s) => s.hideLive);
  const hiddenPickIds = useDeskStore((s) => s.hiddenPickIds);
  const inSport = (p: DeskPick) => {
    if (!pickInSport(p, sportFilter)) return false;
    if (hideCollege && (isCollegeSport(p.sport) || p.parlay?.sports?.some(isCollegeSport))) return false;
    if (hiddenPickIds.includes(p.id)) return false;
    return true;
  };
  const popular = sortByMood((picks?.popular ?? []).filter(inSport).filter((p) => !p.row?.inPlay || !hideLive), "safe");
  const hero = picks ? pickHero([picks.hero, ...popular].filter((p): p is DeskPick => Boolean(p)).filter(inSport), popular, "safe") : null;
  const cards = (hero ? [hero, ...popular.filter((p) => p.id !== hero.id)] : popular).slice(0, 8);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-emerald-500">One screen. Kickoff, the pick, the dollars.</p>
        <h1 className="font-display mt-1 text-3xl text-ink">Game day</h1>
        <p className="mt-2 text-sm text-ink/80">
          Photograph Hard Rock to confirm the live number. This site never places a bet.
        </p>
      </header>
      {snapshot?.hours.label ? <p className="text-xs text-muted">{snapshot.hours.label}</p> : null}
      <p className="text-xs text-muted">
        Core {formatBetUsd(split.core)} · Fun {formatBetUsd(split.fun)}. 3-pick tickets use Fun dollars so they cannot eat Core.
      </p>
      {!cards.length ? (
        <p className="text-sm text-muted">Nothing named yet. Open AI Picks, or photograph a Hard Rock screen.</p>
      ) : (
        <ul className="grid gap-3">
          {cards.map((p) => {
            const fun = Boolean((p.parlay && p.parlay.legs.length >= 3) || (p.price != null && p.price >= 130));
            const dollars = fun ? split.funTicket || stake : stake;
            const fee = feeBadge(p.row?.hold);
            const timing = timingKind({
              steam: p.tapeLean === "sharp",
              tapeLean: p.tapeLean,
              favorite: (p.price ?? 0) < 0,
            });
            return (
              <li key={p.id} className="paper-card p-5">
                <p className="stamp text-emerald-500">
                  {hero && p.id === hero.id ? "The Call" : sportLabel(p.sport)}
                  {p.start ? ` · ${formatKickoff(p.start, true)}` : ""}
                </p>
                <h2 className="font-display mt-2 text-2xl text-ink">{p.selection}</h2>
                <p className="mt-1 text-sm text-emerald-500">
                  Find it on Hard Rock Bet Florida
                  {p.price != null ? ` at ${formatAmerican(p.price)}` : ""}.
                </p>
                <p className="mt-3 font-display text-3xl tabular-nums text-emerald-500">
                  {formatChancePct(p.chance) ?? "—"}
                </p>
                <p className="text-sm text-ink">Chance it hits. Not a guarantee.</p>
                <p className="mt-2 text-base text-ink">
                  Recommended stake {formatBetUsd(dollars)}
                  {fun ? " · Fun / lotto dollars" : " · Core 1%"}
                  {p.price != null && dollars > 0
                    ? ` · if it hits you get about ${formatBetUsd(dollars * (p.decimalPayout || 1))} back`
                    : ""}
                  .
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fee ? <span className="rounded-sm bg-wash px-2 py-1 text-xs text-muted">{fee.text}</span> : null}
                  {timing ? (
                    <span className="rounded-sm bg-wash-gold px-2 py-1 text-xs text-emerald-500">{TIMING_COPY[timing].title}</span>
                  ) : null}
                  {p.earlyMover ? (
                    <span className="rounded-sm bg-wash-gold px-2 py-1 text-xs text-emerald-500">Early Mover Advantage</span>
                  ) : null}
                </div>
                {timing ? <p className="mt-2 text-xs text-muted">{TIMING_COPY[timing].line}</p> : null}
                <Link
                  to="/ticket"
                  search={{ id: p.id }}
                  hash="lock-in"
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-medium text-zinc-950"
                >
                  <Camera className="size-4" strokeWidth={1.75} />
                  Confirm with Hard Rock Photo
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">
        {scan?.rows.length ? `${scan.rows.length} delayed rows on the board.` : "Board still loading."} 21+ stays in
        the footer.
      </p>
    </div>
  );
}
