import { getSql } from "./src/lib/db.ts";
import { getTuning, updateTuning } from "./src/lib/tuning-api.ts";

async function test() {
  console.log("Initial:", await getTuning());
  console.log("Updating to 8.0...");
  await updateTuning({
    minEdge: 8.0,
    kellyMultiplier: 0.25,
    maxLegs: 3,
    activeFeeds: ["espn"]
  });
  console.log("After update:", await getTuning());
}

test().catch(console.error);