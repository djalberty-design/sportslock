import { useDeskDecision } from "@/lib/market/use-board";
import { useDeskStore } from "@/lib/desk-store";
import { pickInSport, sortByMood, type DeskPick } from "@/lib/market/picks";
import { PickCard } from "./pick-card";
import { Link } from "@tanstack/react-router";

export function LivePage() {
  const { picks, query } = useDeskDecision();
  const sportFilter = useDeskStore((s) => s.sportFilter);
  const paperTickets = useDeskStore((s) => s.paperTickets);

  const activeEventIds = new Set(
    paperTickets.filter((t) => t.status === "open").flatMap((t) => t.gameIds)
  );

  const inSport = (p: DeskPick) => {
    if (!pickInSport(p, sportFilter)) return false;
    return true;
  };
  
  const isLive = (p: DeskPick) => Boolean(p.row?.inPlay);
  const isActiveTicket = (p: DeskPick) => activeEventIds.has(p.eventId);

  const live = sortByMood(
    [...(picks?.popular ?? []), ...(picks?.props ?? []), ...(picks?.periods ?? [])]
      .filter(inSport)
      .filter(isLive)
      .filter(isActiveTicket),
    "safe",
  );

  const activeCount = paperTickets.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-emerald-500">Sweat Station</p>
        <h1 className="font-display mt-1 text-3xl text-ink md:text-4xl">Live</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/80">
          Focus mode. Only live games tied to your active, logged tickets are shown here.
        </p>
      </header>

      {query.isError ? (
        <p className="rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500">
          Live board missing. Wait for the feed to restore.
        </p>
      ) : null}

      {!picks && !query.isError ? <p className="text-muted">Reading in-play tickets...</p> : null}

      {picks && !live.length ? (
        <section className="paper-card p-5">
          <p className="stamp text-emerald-500">Relax</p>
          <h2 className="font-display mt-2 text-xl text-ink">No active tickets are live right now. Relax.</h2>
          <p className="mt-2 text-sm text-muted">
            {activeCount === 0 
              ? "You have no open tickets logged in the system. When you place a bet, photograph and log it to sweat it here." 
              : "You have open tickets, but none of those games are currently in-play."}
          </p>
        </section>
      ) : null}

      {live.length > 0 ? (
        <section>
          <ul className="grid gap-3 md:grid-cols-2">
            {live.map((pick, i) => (
              <li key={pick.id}>
                <PickCard pick={pick} rank={i + 1} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

