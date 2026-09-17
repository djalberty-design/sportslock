import { getBoardSnapshot } from "./src/lib/market/server";
import { getSql } from "./src/lib/db";
const snap = await getBoardSnapshot();
console.log("Picks sample:", JSON.stringify(snap.quotes.filter(q => q.isProp || !["ml", "spread", "total"].includes(q.marketType)).slice(0, 2), null, 2));