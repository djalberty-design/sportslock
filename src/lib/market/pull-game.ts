import { createServerFn } from "@tanstack/react-start";
import { fetchOddsApiEvent, fetchOddsApiProps } from "./odds-api";

export const fetchGameOddsFn = createServerFn({ method: "POST" })
  .validator((d: { sportKey: string; eventId: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; data?: any; error?: string }> => {
    try {
      const res = await fetchOddsApiEvent(data.sportKey, data.eventId);
      if (!res) return { ok: false, error: "Failed to pull this game from Odds API" };
      return { ok: true, data: res };
    } catch (e: any) {
      return { ok: false, error: String(e) };
    }
  });

export const fetchRealPropsForceFn = createServerFn({ method: "POST" })
  .validator((d: { sportKey: string; eventId: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; data?: any; error?: string }> => {
    try {
      const res = await fetchOddsApiProps(data.sportKey, data.eventId, true);
      if (!res) return { ok: false, error: "Failed to fetch from Odds-API" };
      return { ok: true, data: res };
    } catch (e: any) {
      return { ok: false, error: String(e) };
    }
  });
