import { Link } from "@tanstack/react-router";
import { BankrollBar, ConnectAppsNote } from "./bankroll-bar";
import { BRAND } from "@/lib/brand";
import { useDeskStore } from "@/lib/desk-store";
import { Combine, Newspaper, Radio, Sparkles, ClipboardList } from "lucide-react";

const TABS = [
  {
    to: "/today" as const,
    icon: Sparkles,
    stamp: "01",
    title: "AI Picks",
    body: "Tonight’s named tickets. Fast Log to lock the live price.",
  },
  {
    to: "/board" as const,
    icon: Newspaper,
    stamp: "02",
    title: "Games",
    body: "Every matchup. Add a leg or Fast Log the number.",
  },
  {
    to: "/parlay" as const,
    icon: Combine,
    stamp: "03",
    title: "Combos",
    body: "2-, 3-, and 4-pick tickets with the best chance they all hit. Or build your own.",
  },
  {
    to: "/live" as const,
    icon: Radio,
    stamp: "04",
    title: "Live",
    body: "Game already started. These numbers use what is left. Never The Call.",
  },
  {
    to: "/desk" as const,
    icon: ClipboardList,
    stamp: "05",
    title: "Log",
    body: "Fast Logged tickets wait here. Tap Hit or Miss after the game.",
  },
];

export function StartPage() {
  const onboarded = useDeskStore((s) => s.onboarded);
  const setOnboarded = useDeskStore((s) => s.setOnboarded);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-sm text-gold">{BRAND.kicker}</p>
        <h1 className="font-display mt-2 text-3xl text-ink md:text-5xl">Set the stake. Then take the ticket.</h1>
        <p className="mt-3 text-base text-ink/80">
          Type what you can spend. AI Picks names a ticket. You place it at Hard Rock Bet Florida if you want. This site never places a bet.
        </p>
      </header>

      {onboarded ? null : (
        <p className="text-sm text-muted">Type what you can spend. Then open AI Picks.</p>
      )}

      <BankrollBar />

      <Link
        to="/today"
        onClick={() => setOnboarded(true)}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-gold px-5 text-base font-medium text-navy-deep sm:w-auto"
      >
        Open AI Picks
      </Link>

      {onboarded ? null : (
        <section>
          <h2 className="font-display text-2xl text-ink">Five desks</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Five desks. Fantasy lives in More. This site never places a bet.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <Link to={tab.to} onClick={() => setOnboarded(true)} className="paper-card block p-5">
                  <p className="stamp text-gold">{tab.stamp}</p>
                  <h3 className="font-display mt-2 flex items-center gap-2 text-xl text-ink">
                    <tab.icon className="size-4 text-gold" strokeWidth={1.75} />
                    {tab.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{tab.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConnectAppsNote />
    </div>
  );
}
