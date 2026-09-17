import { getTuning, updateTuning } from "./src/lib/tuning-api";

async function runDiagnostics() {
  console.log("\n--- EXECUTING TUNING WRITE ---");
  try {
    await updateTuning({
      minEdge: 8.0,
      kellyMultiplier: 0.25,
      maxLegs: 3,
      activeFeeds: ["espn"]
    });
    console.log("WRITE SUCCESSFUL");
  } catch (e) {
    console.error("WRITE CRASHED:", e);
  }

  console.log("\n--- EXECUTING TUNING READ ---");
  try {
    const res = await getTuning();
    console.log("READ RESULT:", res);
  } catch (e) {
    console.error("READ CRASHED:", e);
  }
}
runDiagnostics();