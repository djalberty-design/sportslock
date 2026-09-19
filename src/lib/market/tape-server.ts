import { createServerFn } from "@tanstack/react-start";
import { getTapeStats, type TapeStats } from "./market-tape";
import { gradeMarketTape, getGradeStats } from "./grade-tape";
import { runTapeAutopsy, getAutopsySummary, type AutopsySummary } from "./autopsy-tape";
import { buildSuggestions, decideSuggestion, listSuggestions, type BrainSuggestion, type SuggestionStatus } from "./suggestions";
import { clearOverride, upsertOverride } from "./overrides";

export const getTapeStatsFn = createServerFn({ method: "GET" }).handler(async (): Promise<TapeStats & {
  wins: number;
  losses: number;
  pushes: number;
  graded: number;
  pendingGrades: number;
}> => {
  const stats = await getTapeStats(true);
  const run = await gradeMarketTape();
  await runTapeAutopsy();
  await buildSuggestions();
  const grades = await getGradeStats();
  return {
    ...stats,
    lastError: stats.lastError || run.error || grades.error,
    wins: grades.wins,
    losses: grades.losses,
    pushes: grades.pushes,
    graded: grades.graded,
    pendingGrades: grades.pending,
  };
});

export const getAutopsySummaryFn = createServerFn({ method: "GET" }).handler(async (): Promise<AutopsySummary> => {
  await gradeMarketTape();
  await runTapeAutopsy();
  return getAutopsySummary();
});

export const getSuggestionsFn = createServerFn({ method: "GET" }).handler(async (): Promise<BrainSuggestion[]> => {
  await gradeMarketTape();
  await runTapeAutopsy();
  await buildSuggestions();
  return listSuggestions();
});

export const decideSuggestionFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: SuggestionStatus }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const current = (await listSuggestions()).find((s) => s.id === data.id);
    const res = await decideSuggestion(data.id, data.status);
    if (!res.ok || !current) return res;
    const proposed = current.proposed || {};
    const sport = String(proposed.sport || "");
    const market = String(proposed.market || "");
    if (data.status === "accepted" && sport && market && (proposed.chanceHaircut || proposed.action === "sit")) {
      await upsertOverride({
        fingerprint: current.fingerprint,
        sport,
        market,
        chanceHaircut: Number(proposed.chanceHaircut || 0),
        sit: proposed.action === "sit",
        note: current.title,
      });
    }
    if (data.status === "rejected" || data.status === "later") {
      await clearOverride(current.fingerprint);
    }
    return res;
  });
