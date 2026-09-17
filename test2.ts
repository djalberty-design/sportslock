import { buildLiveSnapshot } from "./src/lib/market/live-board";
buildLiveSnapshot().then(snap => {
  console.log("Success, quotes length:", snap.quotes.length);
}).catch(err => {
  console.error("CRASH:", err);
});
