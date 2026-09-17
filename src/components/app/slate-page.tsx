import { Link } from "@tanstack/react-router";
import { DfsDesk } from "./dfs-desk";
import { DFS_DISCLAIMER } from "@/lib/market/dfs-law";

export function SlatePage() {
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-emerald-500">DraftKings Fantasy · not a Florida sportsbook fill</p>
        <h1 className="font-display mt-2 text-3xl text-ink md:text-5xl">Fantasy</h1>
        <p className="mt-3 text-base text-ink/80">
          Salary-cap roster on DraftKings Fantasy. Photograph the player list and the contest lobby. We name a Safer cash
          lineup, a High-Ceiling tournament stack, and a Showdown captain. We never submit it.
        </p>
      </header>
      <p className="rounded-md bg-wash px-4 py-3 text-sm text-ink/80">{DFS_DISCLAIMER}</p>
      <DfsDesk />
      <Link
        to="/today"
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-500 px-5 text-base font-medium text-zinc-950"
      >
        Open AI Picks
      </Link>
    </div>
  );
}
