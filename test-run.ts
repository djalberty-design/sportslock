import { buildLiveSnapshot } from "./src/lib/market/live-board";
async function run() {
  try {
    const snap = await buildLiveSnapshot();
    console.log("Quotes:", snap.quotes?.length);
    console.log("SourceNote:", snap.sourceNote);
  } catch (e) {
    console.error("CRASH:", e);
  }
}
run();