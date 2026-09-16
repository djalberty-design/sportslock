import { buildLiveSnapshot } from "./src/lib/market/live-board.ts";
import { rankDesk } from "./src/lib/market/rank.ts";

async function main() {
  console.log("Starting buildLiveSnapshot...");
  try {
    const snap = await buildLiveSnapshot();
    console.log("Quotes fetched:", snap.quotes.length);
    console.log("Starting rankDesk...");
    const { scan, picks } = rankDesk(snap, false);
    console.log("Rank success! Picks:", picks.hero?.id);
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

main();
