import { fetchOddsApiMains, getOddsQuota, writeOddsApiCache } from "./odds-api";

export type EspnProbe = {
  sport: string;
  path: string;
  status: number | null;
  ok: boolean;
  events?: number;
  error?: string;
};

export type MorningPullResult = {
  at: string;
  source: "morning-pull";
  sports: string[];
  eventCounts: Record<string, number>;
  quotaRemaining: number | null;
  espn: EspnProbe[];
};

const ESPN_SCOREBOARD: { sport: string; path: string }[] = [
  { sport: "NFL", path: "football/nfl" },
  { sport: "NCAAF", path: "football/college-football" },
  { sport: "MLB", path: "baseball/mlb" },
  { sport: "NBA", path: "basketball/nba" },
  { sport: "NHL", path: "hockey/nhl" },
  { sport: "NCAAB", path: "basketball/mens-college-basketball" },
];

export async function probeEspnMorning(): Promise<EspnProbe[]> {
  const out: EspnProbe[] = [];
  for (const row of ESPN_SCOREBOARD) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${row.path}/scoreboard`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      let events: number | undefined;
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const list = json?.events;
        events = Array.isArray(list) ? list.length : undefined;
      }
      out.push({
        sport: row.sport,
        path: row.path,
        status: res.status,
        ok: res.ok,
        events,
      });
    } catch (e) {
      out.push({
        sport: row.sport,
        path: row.path,
        status: null,
        ok: false,
        error: String(e),
      });
    }
  }
  return out;
}

export async function runMorningPull(): Promise<MorningPullResult> {
  const mains = await fetchOddsApiMains(true);
  const eventCounts: Record<string, number> = {};
  const sports: string[] = [];
  for (const group of mains ?? []) {
    const sport = group?.sport ?? "unknown";
    sports.push(sport);
    eventCounts[sport] = Array.isArray(group?.data) ? group.data.length : 0;
  }
  const espn = await probeEspnMorning();
  const stamp: MorningPullResult = {
    at: new Date().toISOString(),
    source: "morning-pull",
    sports,
    eventCounts,
    quotaRemaining: getOddsQuota(),
    espn,
  };
  await writeOddsApiCache("morning-pull", stamp);
  return stamp;
}
