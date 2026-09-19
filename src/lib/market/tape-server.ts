import { createServerFn } from "@tanstack/react-start";
import { getTapeStats, type TapeStats } from "./market-tape";
import { gradeMarketTape, getGradeStats } from "./grade-tape";
import { runTapeAutopsy, getAutopsySummary, type AutopsySummary } from "./autopsy-tape";
import { buildSuggestions, decideSuggestion, listSuggestions, type BrainSuggestion, type SuggestionStatus } from "./suggestions";

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
    return decideSuggestion(data.id, data.status);
  });
