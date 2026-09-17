import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export function GuidePage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <p className="rounded-md bg-wash px-4 py-3 text-sm text-ink">
        Longer FAQ. Start with{" "}
        <Link to="/learn" className="font-medium text-emerald-500 underline-offset-4 hover:underline">
          Learn
        </Link>{" "}
        if the words are new.
      </p>
      <h1 className="font-display text-3xl text-ink">What this app will not do</h1>
      <ul className="list-disc space-y-2 pl-5 text-sm">
        <li>It will not place, cancel, or send a Hard Rock Bet ticket. This site never places a bet.</li>
        <li>It will not call a 3-game parlay a “lock,” a guaranteed winner, or a path to $1M.</li>
        <li>It will not recommend college player bets or DraftKings / FanDuel sportsbook Florida tickets.</li>
        <li>It will not auto-bet in-play. Live is leftover-mean research only — never The Call, never a ribbon leg.</li>
        <li>It will not mix investing or crypto screens into this UI.</li>
        <li>It will not send texts, scrape your Hard Rock balance, or nag you to bet.</li>
      </ul>
      <p className="text-sm text-muted">
        {BRAND.kicker}. {BRAND.helpline}. 21+ / Florida geofence for live sports.
      </p>
    </article>
  );
}
