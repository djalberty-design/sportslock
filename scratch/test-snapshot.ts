import { buildLiveSnapshot } from "../src/lib/market/live-board.ts";

async function run() {
  console.log("Running buildLiveSnapshot()...");
  try {
    const snap = await buildLiveSnapshot();
    console.log("SUCCESS! Fetched", snap.quotes.length, "quotes.");
    console.log("Timestamp:", snap.asOf);
  } catch (err: any) {
    console.error("\n=== FATAL ERROR ===\n");
    console.error(err);
    console.error("\nStack Trace:\n", err.stack);
  }
}

run();
