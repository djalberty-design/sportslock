import { combinedOdds, type ParlayLeg } from "../parlay-slip.ts";
import { hardRockLastMile } from "./hard-rock-links.ts";

export function slipCopyText(legs: ParlayLeg[]): string {
  if (!legs.length) return "";
  const first = legs[0]!;
  const matchup = first.away && first.home ? `${first.away} at ${first.home}` : "";
  const pick = legs.map((l) => l.selection).join(" · ");
  const { american } = combinedOdds(legs);
  const price = parseInt(String(american).replace(/[^0-9+-]/g, ""), 10);
  return hardRockLastMile({
    sport: first.sport,
    matchup,
    pick,
    price: Number.isFinite(price) ? price : null,
  }).copyText;
}
