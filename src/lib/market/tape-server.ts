import { createServerFn } from "@tanstack/react-start";
import { getTapeStats, listTapeDesk, type TapeDeskRow, type TapeStats } from "./market-tape";
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

export const getTapeDeskFn = createServerFn({ method: "GET" }).handler(async (): Promise<TapeDeskRow[]> => {
  return listTapeDesk(80);
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
    if (data.status === "rejected" || data.status === "later" || data.status === "revoked") {
      await clearOverride(current.fingerprint);
      // Also clear auto-applied overrides
      if (data.status === "revoked" && current.proposed) {
        const autoFp = `auto|cold-sport|${current.proposed.sport || ""}`;
        await clearOverride(autoFp);
      }
    }
    // Log to activity feed
    try {
      const { logActivity } = await import("@/lib/market/activity");
      void logActivity("suggestion", `Suggestion ${data.status}`, `${current.title} (${sport} ${market})`, "admin");
    } catch {}
    return res;
  });

export const getDynamicWeightsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAllSportsWeights } = await import("./dynamic-weights");
  return getAllSportsWeights();
});

export const calibrateWeightsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { calibrateWeights } = await import("./dynamic-weights");
  return calibrateWeights();
});

export const updateSportWeightsFn = createServerFn({ method: "POST" })
  .validator((d: { sport: string; wSim: number; wPool: number; wMarket: number; notes?: string }) => d)
  .handler(async ({ data }) => {
    const { updateSportWeights } = await import("./dynamic-weights");
    return updateSportWeights(data);
  });

export const listHypothesesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listHypotheses } = await import("./hypotheses");
  return listHypotheses();
});

export const submitHypothesisFn = createServerFn({ method: "POST" })
  .validator((d: { query: string; notes?: string }) => d)
  .handler(async ({ data }) => {
    const { submitHypothesis } = await import("./hypotheses");
    return submitHypothesis(data.query, data.notes);
  });

export const checkCircuitBreakersFn = createServerFn({ method: "POST" }).handler(async () => {
  const { checkCircuitBreakers } = await import("./dynamic-weights");
  return checkCircuitBreakers();
});

export const resetCircuitBreakerFn = createServerFn({ method: "POST" })
  .validator((d: { sport: string }) => d)
  .handler(async ({ data }) => {
    const { resetCircuitBreaker } = await import("./dynamic-weights");
    return resetCircuitBreaker(data.sport);
  });


