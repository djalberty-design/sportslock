import { createServerFn } from "@tanstack/react-start";
import { getTapeStats, type TapeStats } from "./market-tape";
import { gradeMarketTape, getGradeStats } from "./grade-tape";
import { runTapeAutopsy, getAutopsySummary, type AutopsySummary } from "./autopsy-tape";

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
