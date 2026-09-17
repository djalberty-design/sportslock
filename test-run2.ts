import { fetchLiveQuotes } from "./src/lib/market/live-board";
async function run() {
  const { quotes, notes } = await fetchLiveQuotes();
  console.log("Quotes:", quotes.length, "Notes:", notes);
}
run();