import { createServerFn } from "@tanstack/react-start";
import { getTapeStats, type TapeStats } from "./market-tape";

export const getTapeStatsFn = createServerFn({ method: "GET" }).handler(async (): Promise<TapeStats> => {
  return getTapeStats();
});
