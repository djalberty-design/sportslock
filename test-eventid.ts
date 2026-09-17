import { getBoardSnapshot } from "./src/lib/market/server";
const snap = await getBoardSnapshot();
console.log(snap.quotes.find(q => q.isProp)?.eventId);