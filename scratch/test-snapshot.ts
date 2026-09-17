import { buildLiveSnapshot } from "./src/lib/market/live-board.ts";
buildLiveSnapshot().then(snap => {
  console.log("Quotes:", snap.quotes.length);
  console.log("Briefs:", snap.briefs.length);
  console.log("Notes:", snap.hours.note);
  console.log("First quote:", snap.quotes[0]);
}).catch(console.error);
