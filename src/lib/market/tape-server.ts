import { createServerFn } from "@tanstack/react-start";
import { getTapeStats, type TapeStats } from "./market-tape";
import { gradeMarketTape, getGradeStats } from "./grade-tape";

export const getTapeStatsFn = createServerFn({ method: "GET" }).handler(async (): Promise<TapeStats & {
  wins: number;
  losses: number;
  pushes: number;
  graded: number;
  pendingGrades: number;
}> => {
  const stats = await getTapeStats(true);
  const run = await gradeMarketTape();
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
