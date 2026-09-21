import { getSql } from "@/lib/db";
import { createServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { buildLiveSnapshot } from "./live-board";
import { ESPN_PATH, applyLeaderStats, enrichResearchForm, fetchEspnRoster, fetchEspnTeamLeaders, mergeResearchPlayers, parseEspnSummary, parseInternalEventId, type EventResearch } from "./research";
import type { ContestOffer, DeskSnapshot, ParsedTicket } from "./types";import { getOddsQuota } from "./odds-api";
import { resolveVisionKey, VISION_MODELS, VISION_UNAVAILABLE } from "./vision-key";
import { authMiddleware } from "@/lib/auth/middleware";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";

/** Verify the current user is an admin. Call AFTER authMiddleware sets context.userId. */
async function assertAdmin(userId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ email: string }>`SELECT email FROM "user" WHERE id = ${userId} LIMIT 1`;
  const email = normalizeEmail(rows[0]?.email);
  if (!isAdminEmail(email)) {
    const listed = await sql<{ role: string }>`SELECT role FROM desk_allowlist WHERE email = ${email} LIMIT 1`;
    if (listed[0]?.role !== "admin") throw new Error("Forbidden");
  }
}

export const getBoardSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<DeskSnapshot> => {
  try {
    return await buildLiveSnapshot();
  } catch (err: any) {
    console.error("SERVER_SNAPSHOT_FATAL_ERROR:", err);
    return {
      asOf: new Date().toISOString(),
      delayed: false,
      sample: false,
      hours: { preGameOpen: false, etStamp: 0, etDate: "", nextLock: null, label: "ERROR", note: `CRASH IN BUILDLIVESNAPSHOT: ${String(err.stack || err)}` },
      quotes: [],
      news: [],
      publicSplits: [],
      briefs: [],
      predict: [],
      sourceNote: "FATAL SERVER ERROR: " + (err?.stack || err?.message || String(err)),
    };
  }
});

export const getEventResearch = createServerFn({ method: "GET" })
  .validator((d: { eventId: string }) => d)
  .handler(async ({ data }): Promise<{ ok: true; research: EventResearch } | { ok: false; error: string }> => {
    const parsed = parseInternalEventId(data.eventId);
    if (!parsed) return { ok: false, error: "That game id is not on the live ESPN board." };
    const path = ESPN_PATH[parsed.sport];
    if (!path) return { ok: false, error: `No research feed for ${parsed.sport}.` };
    try {
      const res = await fetch(
        `https://site.web.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(parsed.espnId)}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SportsLock/1.0)", Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) return { ok: false, error: "ESPN research did not load. Try again in a minute." };
      const json: unknown = await res.json();
      let research = parseEspnSummary(json, data.eventId, parsed.sport, parsed.espnId);
      if (research.homeTeamId || research.awayTeamId) {
        const college = parsed.sport === "NCAAF" || parsed.sport === "NCAAB";
        const [homeR, awayR, homeL, awayL] = await Promise.all([
          research.homeTeamId
            ? fetchEspnRoster(path, research.homeTeamId, research.home, "home")
            : Promise.resolve([]),
          research.awayTeamId
            ? fetchEspnRoster(path, research.awayTeamId, research.away, "away")
            : Promise.resolve([]),
          !college && research.homeTeamId
            ? fetchEspnTeamLeaders(parsed.sport, research.homeTeamId)
            : Promise.resolve(new Map<string, Record<string, number>>()),
          !college && research.awayTeamId
            ? fetchEspnTeamLeaders(parsed.sport, research.awayTeamId)
            : Promise.resolve(new Map<string, Record<string, number>>()),
        ]);
        research.players = applyLeaderStats(mergeResearchPlayers(research.players, [...homeR, ...awayR]), [homeL, awayL]);
      }
      research = await enrichResearchForm(research, path);
      return { ok: true, research };
    } catch {
      return { ok: false, error: "Could not reach ESPN for this game." };
    }
  });

export const parseTicketImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { image: string; mime?: string; kind?: "ticket" | "slate" | "contest" | "auto" }) => d)
  .handler(async ({ data }): Promise<
    | { ok: true; kind: "ticket"; fields: ParsedTicket[]; note: string }
    | { ok: true; kind: "slate"; table: string; note: string }
    | { ok: true; kind: "contest"; contests: ContestOffer[]; note: string }
    | { ok: false; error: string }
  > => {
    const apiKey = resolveVisionKey();
    if (!apiKey) {
      return { ok: false, error: VISION_UNAVAILABLE };
    }
    const mime = data.mime || "image/jpeg";
    const url = data.image.startsWith("data:") ? data.image : `data:${mime};base64,${data.image}`;
    const ticketPrompt = `You extract sports betting ticket fields from a screenshot. Return ONLY JSON:
{"kind":"ticket","fields":[{"sport":"NFL|NBA|MLB|NHL|NCAAF|NCAAB","home":"full home team","away":"full away team","marketType":"ml|spread|total|prop","side":"home|away|over|under|yes|no","selection":"short label like Phillies to win or Mahomes over 249.5 passing yards","price":-110,"point":null,"player":null,"confidence":0.0,"start":null}]}
Rules: If the photo is a PARLAY, put EVERY leg in fields (2+ objects). confidence 0-1. Never write "ML" in selection, say "to win". Include home, away, and kickoff if visible. Never invent a team, price, or game that is not in the photo. Empty fields array if nothing is readable. Sports: NFL, NBA, MLB, NHL, NCAAF, NCAAB equally.
PLAYER BETS (personal achievements in a game): marketType="prop". Set player=full athlete name, point=the line (249.5, 27.5, 0.5, 1.5, 6.5), side=over|under|yes|no, selection="Mahomes over 249.5 passing yards" (include the stat in words: passing yards, rushing yards, receiving yards, receptions, anytime touchdown, points, rebounds, assists, threes, hits, strikeouts, home run, total bases, hits + runs + RBIs, batter runs, RBIs, walks, stolen bases, shots on goal, saves, goals). Alternate lines (O 1.5 vs O 0.5, -2.5 vs -1.5) are separate fields. Team totals ("Reds over 3.5") are marketType="total" with the team in selection. These feed a custom player-bet model once the user confirms.`;
    const slatePrompt = `You extract a DraftKings classic salary-cap player table. Return ONLY JSON:
{"kind":"slate","table":"Name,Pos,Team,Salary,Proj\\nMahomes,QB,KC,7800,24"}
One player per line. Salary integers. If unreadable, empty table.`;
    const contestPrompt = `You extract DraftKings daily-fantasy contest offers from a lobby screenshot. Return ONLY JSON:
{"kind":"contest","contests":[{"name":"NFL $5 Double Up","buyIn":5,"fieldSize":20,"prize":9,"kind":"cash"}]}
kind is cash (50/50, double-up, head-to-head) or gpp (tournament, millionaire, satellite). buyIn is dollars. If unreadable, empty contests.`;
    const autoPrompt = `You are looking at a screenshot from a sportsbook or daily fantasy app. Classify and extract. Return ONLY JSON in one of these shapes:
{"kind":"ticket","fields":[{"sport":"NFL","home":"","away":"","marketType":"ml","side":"home","selection":"Baltimore to win","price":-110,"point":null,"player":null,"confidence":0.8,"start":null}]}
{"kind":"slate","table":"Name,Pos,Team,Salary,Proj\\nMahomes,QB,KC,7800,24"}
{"kind":"contest","contests":[{"name":"NFL $5 Double Up","buyIn":5,"fieldSize":20,"prize":9,"kind":"cash"}]}
Rules: ticket = Hard Rock / DraftKings odds. slate = player salary list. contest = DFS lobby with buy-ins. Never invent numbers or games you cannot read. Never write "ML", say "to win". Sports: NFL, NBA, MLB, NHL, NCAAF, NCAAB equally.`;

    const prompt =
      data.kind === "slate" ? slatePrompt : data.kind === "contest" ? contestPrompt : data.kind === "auto" ? autoPrompt : ticketPrompt;

    let text = "";
    let lastStatus = 0;
    for (const model of VISION_MODELS) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1600,
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url } },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
      lastStatus = res.status;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: "Vision key was rejected. Check XAI_API_KEY on Vercel, then Redeploy." };
        }
        continue;
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      text = body.choices?.[0]?.message?.content ?? "";
      if (text.trim()) break;
    }
    if (!text.trim()) {
      return { ok: false, error: `Parse failed (${lastStatus || "no model"}). Enter fields by hand.` };
    }
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      return { ok: false, error: "Could not read structured fields. Enter them by hand." };
    }
    try {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
        kind?: string;
        fields?: ParsedTicket[];
        table?: string;
        contests?: Array<Partial<ContestOffer>>;
      };
      const detected = (parsed.kind ?? data.kind ?? "ticket") as string;
      if (detected === "slate" || (data.kind === "slate" && parsed.table != null)) {
        return {
          ok: true,
          kind: "slate",
          table: parsed.table ?? "",
          note: "Confirm every row before the optimizer runs. Low confidence does not score.",
        };
      }
      if (detected === "contest" || parsed.contests) {
        const contests: ContestOffer[] = (parsed.contests ?? [])
          .map((c): ContestOffer => ({
            name: String(c.name ?? "Contest"),
            buyIn: Number(c.buyIn ?? 0),
            fieldSize: c.fieldSize != null ? Number(c.fieldSize) : undefined,
            prize: c.prize != null ? Number(c.prize) : undefined,
            kind: c.kind === "gpp" || c.kind === "cash" ? c.kind : "unknown",
            confirmed: false,
          }))
          .filter((c) => Number.isFinite(c.buyIn) && c.buyIn > 0);
        return {
          ok: true,
          kind: "contest",
          contests,
          note: contests.length
            ? "Check the buy-ins, then tap Use these buy-ins."
            : "No buy-ins read. Enter a contest photo with dollar amounts visible.",
        };
      }
      const fields = (parsed.fields ?? []).map((f) => ({
        ...f,
        confirmed: false,
        confidence: Number(f.confidence ?? 0),
      }));
      return {
        ok: true,
        kind: "ticket",
        fields,
        note: "Only confirmed fields enter the scan. Low confidence stays out until you edit and confirm.",
      };
    } catch {
      return { ok: false, error: "Could not parse the model JSON. Enter fields by hand." };
    }
  });



export const getPredictionLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
  try {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const logs = await sql`SELECT * FROM prediction_logs ORDER BY created_at DESC LIMIT 200`;
    return logs;
  } catch (err) {
    console.error("Failed to fetch prediction logs:", err);
    return [];
  }
});
export const getOddsQuotaFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<number | null> => {
  await assertAdmin(context.userId);
  return getOddsQuota();
});

export const fetchRealPropsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { sportKey: string, eventId: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: boolean; props?: any[]; error?: string }> => {
    try {
      await assertAdmin(context.userId);
      const { fetchOddsApiProps } = await import("@/lib/market/odds-api");
      const res = await fetchOddsApiProps(data.sportKey, data.eventId, true);
      if (!res) return { ok: false, error: "Odds API returned empty response" };
      if (res.__error) return { ok: false, error: `Odds API HTTP ${res.status}: ${res.message || "Unknown error"}` };

      // Normalize raw Odds API response into QuoteLine-compatible props
      const props: any[] = [];
      const event = res;
      const home = event.home_team || event.homeTeam || "";
      const away = event.away_team || event.awayTeam || "";
      const sport = data.sportKey.includes("nfl") ? "NFL"
        : data.sportKey.includes("ncaaf") ? "NCAAF"
        : data.sportKey.includes("nba") ? "NBA"
        : data.sportKey.includes("ncaab") ? "NCAAB"
        : data.sportKey.includes("mlb") ? "MLB"
        : data.sportKey.includes("nhl") ? "NHL"
        : data.sportKey.toUpperCase();

      const bookmakers = event.bookmakers || [];
      for (const bk of bookmakers) {
        for (const mkt of bk.markets || []) {
          for (const outcome of mkt.outcomes || []) {
            const price = outcome.price || -110;
            const implied = price < 0
              ? Math.abs(price) / (Math.abs(price) + 100)
              : 100 / (price + 100);
            props.push({
              eventId: `oddsapi-${sport}-${data.eventId}`,
              sport,
              home,
              away,
              selection: outcome.description
                ? `${outcome.description} ${outcome.name} ${outcome.point ?? ""}`
                : `${outcome.name} ${outcome.point ?? ""}`,
              player: outcome.description || undefined,
              marketType: mkt.key || "prop",
              point: outcome.point,
              price,
              fairProb: implied,
              isProp: true,
              source: bk.key || "odds-api",
            });
          }
        }
      }

      return { ok: true, props };
    } catch (e: any) {
      return { ok: false, error: String(e) };
    }
  });

/** Load cached props for a game (no API call, free) */
export const getCachedPropsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { sportKey: string; eventId: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; props?: any[]; fetchedAt?: string }> => {
    try {
      const { readOddsApiCache } = await import("@/lib/market/odds-api");
      const rawId = data.eventId.replace(/^oddsapi-[A-Z]+-/, "");
      const cacheKey = `props:${rawId}`;
      const cached = await readOddsApiCache(cacheKey);
      if (!cached?.data) return { ok: false };

      // Normalize just like fetchRealPropsFn does
      const event = cached.data;
      const home = event.home_team || event.homeTeam || "";
      const away = event.away_team || event.awayTeam || "";
      const sport = data.sportKey.includes("nfl") ? "NFL"
        : data.sportKey.includes("ncaaf") ? "NCAAF"
        : data.sportKey.includes("nba") ? "NBA"
        : data.sportKey.includes("ncaab") ? "NCAAB"
        : data.sportKey.includes("mlb") ? "MLB"
        : data.sportKey.includes("nhl") ? "NHL"
        : data.sportKey.toUpperCase();

      const props: any[] = [];
      const bookmakers = event.bookmakers || [];
      for (const bk of bookmakers) {
        for (const mkt of bk.markets || []) {
          for (const outcome of mkt.outcomes || []) {
            const price = outcome.price || -110;
            const implied = price < 0
              ? Math.abs(price) / (Math.abs(price) + 100)
              : 100 / (price + 100);
            props.push({
              eventId: data.eventId,
              sport,
              home,
              away,
              selection: outcome.description
                ? `${outcome.description} ${outcome.name} ${outcome.point ?? ""}`
                : `${outcome.name} ${outcome.point ?? ""}`,
              player: outcome.description || undefined,
              marketType: mkt.key || "prop",
              point: outcome.point,
              price,
              fairProb: implied,
              isProp: true,
              source: bk.key || "odds-api",
            });
          }
        }
      }

      return { ok: true, props, fetchedAt: cached.fetchedAt.toISOString() };
    } catch (e) {
      return { ok: false };
    }
  });

export const lockPredictionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { legs: Array<{ eventId: string; selection: string; marketType: string; point?: number; price: number; fairProb: number }> }) => d)
  .handler(async ({ data, context }): Promise<{ ok: boolean; count: number }> => {
    try {
      await assertAdmin(context.userId);
      const { logPrediction } = await import("@/lib/market/ledger");
      let count = 0;
      for (const leg of data.legs) {
        await logPrediction(
          { eventId: leg.eventId, selection: leg.selection, marketType: leg.marketType, point: leg.point, price: leg.price, fairProb: leg.fairProb } as any,
          { source: "manual-lock-in", ts: new Date().toISOString() }
        );
        count++;
      }
      return { ok: true, count };
    } catch (e: any) {
      console.error("lockPredictionFn error:", e);
      return { ok: false, count: 0 };
    }
  });

export const getTuningFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ kelly: number; maxLegs: number; minEdge: number }> => {
    try {
      await assertAdmin(context.userId);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const rows = await sql`SELECT kelly, max_legs, min_edge FROM desk_tuning_raw WHERE id = 1`;
      if (rows.length > 0) {
        return { kelly: rows[0].kelly ?? 0.25, maxLegs: rows[0].max_legs ?? 3, minEdge: rows[0].min_edge ?? 2.5 };
      }
      return { kelly: 0.25, maxLegs: 3, minEdge: 2.5 };
    } catch {
      return { kelly: 0.25, maxLegs: 3, minEdge: 2.5 };
    }
  });

export const saveTuningFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { kelly: number; maxLegs: number; minEdge: number }) => d)
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    try {
      await assertAdmin(context.userId);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        UPDATE desk_tuning_raw
        SET kelly = ${data.kelly}, max_legs = ${data.maxLegs}, min_edge = ${data.minEdge}
        WHERE id = 1
      `;
      return { ok: true };
    } catch (e: any) {
      console.error("saveTuningFn error:", e);
      return { ok: false };
    }
  });

export type BrainStats = {
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  winRate: number;
  byMarket: { market: string; total: number; wins: number; winRate: number }[];
  bySport: { sport: string; total: number; wins: number; winRate: number }[];
  byEdgeTier: { tier: string; total: number; wins: number; winRate: number }[];
  recentLogs: {
    id: string;
    eventId: string;
    selection: string;
    marketType: string;
    modelProb: number;
    edge: number;
    status: string;
    autopsy: string | null;
    createdAt: string;
  }[];
  autopsySummary: { highVariance: number; modelError: number; unreviewed: number };
  streakData: { currentStreak: number; streakType: string; longestWin: number; longestLoss: number };
};

export const getBrainStatsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BrainStats> => {
    try {
      await assertAdmin(context.userId);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();

      // Overall stats
      const totals = await sql`
        SELECT 
          count(*)::int as total,
          count(*) filter (where status = 'WIN')::int as wins,
          count(*) filter (where status = 'LOSS')::int as losses,
          count(*) filter (where status = 'PUSH')::int as pushes,
          count(*) filter (where status = 'PENDING')::int as pending
        FROM prediction_logs
      `;
      const t = totals[0] || { total: 0, wins: 0, losses: 0, pushes: 0, pending: 0 };
      const decided = t.wins + t.losses;
      const winRate = decided > 0 ? Math.round((t.wins / decided) * 1000) / 10 : 0;

      // By market type
      const byMarketRaw = await sql`
        SELECT market_type as market,
          count(*)::int as total,
          count(*) filter (where status = 'WIN')::int as wins
        FROM prediction_logs
        WHERE status IN ('WIN', 'LOSS')
        GROUP BY market_type ORDER BY total DESC
      `;
      const byMarket = byMarketRaw.map((r) => ({
        market: r.market || "unknown",
        total: r.total,
        wins: r.wins,
        winRate: r.total > 0 ? Math.round((r.wins / r.total) * 1000) / 10 : 0,
      }));

      // By sport (extracted from event_id prefix)
      const bySportRaw = await sql`
        SELECT 
          split_part(event_id, '-', 2) as sport,
          count(*)::int as total,
          count(*) filter (where status = 'WIN')::int as wins
        FROM prediction_logs
        WHERE status IN ('WIN', 'LOSS')
        GROUP BY split_part(event_id, '-', 2) ORDER BY total DESC
      `;
      const bySport = bySportRaw.map((r) => ({
        sport: r.sport || "unknown",
        total: r.total,
        wins: r.wins,
        winRate: r.total > 0 ? Math.round((r.wins / r.total) * 1000) / 10 : 0,
      }));

      // By edge tier
      const byEdgeRaw = await sql`
        SELECT 
          CASE 
            WHEN edge >= 0.10 THEN 'HIGH (10%+)'
            WHEN edge >= 0.05 THEN 'MEDIUM (5-10%)'
            WHEN edge >= 0.02 THEN 'LOW (2-5%)'
            ELSE 'MICRO (<2%)'
          END as tier,
          count(*)::int as total,
          count(*) filter (where status = 'WIN')::int as wins
        FROM prediction_logs
        WHERE status IN ('WIN', 'LOSS')
        GROUP BY tier ORDER BY total DESC
      `;
      const byEdgeTier = byEdgeRaw.map((r) => ({
        tier: r.tier,
        total: r.total,
        wins: r.wins,
        winRate: r.total > 0 ? Math.round((r.wins / r.total) * 1000) / 10 : 0,
      }));

      // Recent logs (last 50)
      const recentRaw = await sql`
        SELECT id, event_id, selection, market_type, model_probability, edge, status, ai_autopsy, created_at
        FROM prediction_logs
        ORDER BY created_at DESC
        LIMIT 50
      `;
      const recentLogs = recentRaw.map((r) => ({
        id: r.id,
        eventId: r.event_id,
        selection: r.selection,
        marketType: r.market_type,
        modelProb: Number(r.model_probability) || 0,
        edge: Number(r.edge) || 0,
        status: r.status,
        autopsy: r.ai_autopsy,
        createdAt: r.created_at,
      }));

      // Autopsy summary
      const autopsyRaw = await sql`
        SELECT 
          count(*) filter (where ai_autopsy ILIKE '%HIGH VARIANCE%')::int as high_variance,
          count(*) filter (where ai_autopsy ILIKE '%MODEL ERROR%')::int as model_error,
          count(*) filter (where status = 'LOSS' AND ai_autopsy IS NULL)::int as unreviewed
        FROM prediction_logs
      `;
      const a = autopsyRaw[0] || { high_variance: 0, model_error: 0, unreviewed: 0 };
      const autopsySummary = { highVariance: a.high_variance, modelError: a.model_error, unreviewed: a.unreviewed };

      // Streak calculation
      const streakRaw = await sql`
        SELECT status FROM prediction_logs
        WHERE status IN ('WIN', 'LOSS')
        ORDER BY created_at DESC
        LIMIT 100
      `;
      let currentStreak = 0;
      let streakType = "NONE";
      let longestWin = 0;
      let longestLoss = 0;
      let curW = 0;
      let curL = 0;
      for (const r of streakRaw) {
        if (r.status === "WIN") { curW++; curL = 0; if (curW > longestWin) longestWin = curW; }
        else { curL++; curW = 0; if (curL > longestLoss) longestLoss = curL; }
      }
      // Current streak from most recent
      if (streakRaw.length > 0) {
        streakType = streakRaw[0].status;
        currentStreak = 1;
        for (let i = 1; i < streakRaw.length; i++) {
          if (streakRaw[i].status === streakType) currentStreak++;
          else break;
        }
      }

      return {
        total: t.total, wins: t.wins, losses: t.losses, pushes: t.pushes, pending: t.pending,
        winRate, byMarket, bySport, byEdgeTier, recentLogs, autopsySummary,
        streakData: { currentStreak, streakType, longestWin, longestLoss },
      };
    } catch (e: any) {
      console.error("getBrainStatsFn error:", e);
      return {
        total: 0, wins: 0, losses: 0, pushes: 0, pending: 0, winRate: 0,
        byMarket: [], bySport: [], byEdgeTier: [], recentLogs: [],
        autopsySummary: { highVariance: 0, modelError: 0, unreviewed: 0 },
        streakData: { currentStreak: 0, streakType: "NONE", longestWin: 0, longestLoss: 0 },
      };
    }
  });

export type BrainInsight = {
  type: string;
  scope: string;
  sport: string | null;
  marketType: string | null;
  metricName: string;
  metricValue: number;
  details: Record<string, unknown>;
  period: string;
  computedAt: string;
};

export const getBrainInsightsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BrainInsight[]> => {
    try {
      await assertAdmin(context.userId);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      // Check if table exists
      const exists = await sql`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'desk_brain_insights' LIMIT 1
      `;
      if (!exists.length) return [];
      const rows = await sql`
        SELECT insight_type, scope, sport, market_type, metric_name, metric_value, details, period, computed_at
        FROM desk_brain_insights
        ORDER BY computed_at DESC
        LIMIT 50
      `;
      return rows.map((r: any) => ({
        type: r.insight_type,
        scope: r.scope,
        sport: r.sport || null,
        marketType: r.market_type || null,
        metricName: r.metric_name,
        metricValue: Number(r.metric_value),
        details: r.details || {},
        period: r.period,
        computedAt: String(r.computed_at),
      }));
    } catch {
      return [];
    }
  });

// ═══════════════════════════════════════════════════════════════
// OVERSEER v2: Batch Grade, Analysis Workbench, Suggestion Apply
// ═══════════════════════════════════════════════════════════════

/** Admin: Trigger manual batch grading of all pending predictions */
export const batchGradeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await assertAdmin(context.userId);
      const { gradeMarketTape } = await import("@/lib/market/grade-tape");
      const result = await gradeMarketTape();
      return result;
    } catch (e: any) {
      return { ok: false, graded: 0, unmatched: 0, historical: 0, expired: 0, error: String(e) };
    }
  });

/** Admin: Apply a brain suggestion (actually change the engine) */
export const applySuggestionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context.userId);
      const { decideSuggestion, listSuggestions } = await import("@/lib/market/suggestions");
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();

      // Update the suggestion status
      await decideSuggestion(data.id, data.status as any);

      // If accepted, apply the proposed changes
      if (data.status === "accepted") {
        const allSuggestions = await listSuggestions();
        const suggestion = allSuggestions.find(s => s.id === data.id);
        if (suggestion?.proposed) {
          // Log the application
          await sql.query(
            `INSERT INTO brain_suggestions (fingerprint, title, body, knob, proposed, evidence, status)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'auto_applied')`,
            [
              `applied:${data.id}`,
              `Applied: ${suggestion.title}`,
              `Admin accepted and applied: ${JSON.stringify(suggestion.proposed)}`,
              suggestion.knob || "none",
              JSON.stringify(suggestion.proposed),
              JSON.stringify({ appliedFrom: data.id, appliedAt: new Date().toISOString() }),
            ],
          );

          // Apply specific proposed changes
          const proposed = suggestion.proposed as Record<string, any>;

          if (proposed.chanceHaircut != null) {
            // Apply a chance haircut to desk_tuning
            const haircut = Number(proposed.chanceHaircut);
            await sql.query(
              `INSERT INTO desk_tuning_raw (id, kelly, max_legs, min_edge, chance_haircut)
               VALUES (1, 0.25, 3, 2.5, $1)
               ON CONFLICT (id) DO UPDATE SET chance_haircut = COALESCE(desk_tuning_raw.chance_haircut, 0) + $1`,
              [haircut],
            );
          }

          if (proposed.minEdge != null) {
            await sql.query(
              `UPDATE desk_tuning_raw SET min_edge = $1 WHERE id = 1`,
              [Number(proposed.minEdge)],
            );
          }

          if (proposed.kelly != null) {
            await sql.query(
              `UPDATE desk_tuning_raw SET kelly = $1 WHERE id = 1`,
              [Number(proposed.kelly)],
            );
          }
        }
      }

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e) };
    }
  });

/** Analysis Workbench: Get filtered prediction tape with aggregates */
export const getAnalysisDataFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    sport?: string;
    marketType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    edgeTier?: string;
    page?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context.userId);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();

      // Ensure autopsy columns exist (they're normally created by autopsy-tape.ts)
      await sql.query(`ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS bucket text`);
      await sql.query(`ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS autopsy_note text`);

      const conditions: string[] = ["recommended = true"];
      const params: any[] = [];
      let pIdx = 1;

      if (data.sport) {
        conditions.push(`sport = $${pIdx++}`);
        params.push(data.sport);
      }
      if (data.marketType) {
        conditions.push(`market_type = $${pIdx++}`);
        params.push(data.marketType);
      }
      if (data.status) {
        if (data.status === "PENDING") {
          conditions.push(`(status IS NULL OR status = 'PENDING')`);
        } else {
          conditions.push(`status = $${pIdx++}`);
          params.push(data.status);
        }
      }
      if (data.dateFrom) {
        conditions.push(`snapped_at >= $${pIdx++}::timestamptz`);
        params.push(data.dateFrom);
      }
      if (data.dateTo) {
        conditions.push(`snapped_at <= $${pIdx++}::timestamptz`);
        params.push(data.dateTo);
      }
      if (data.edgeTier === "HIGH") {
        conditions.push(`ABS(edge) >= 5`);
      } else if (data.edgeTier === "LOW") {
        conditions.push(`ABS(edge) >= 2 AND ABS(edge) < 5`);
      } else if (data.edgeTier === "MICRO") {
        conditions.push(`ABS(edge) < 2`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const offset = ((data.page || 1) - 1) * 50;

      // Get aggregates
      const aggQuery = `
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE status = 'WIN')::int AS wins,
          count(*) FILTER (WHERE status = 'LOSS')::int AS losses,
          count(*) FILTER (WHERE status = 'PUSH')::int AS pushes,
          count(*) FILTER (WHERE status IS NULL OR status = 'PENDING')::int AS pending,
          count(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
          CASE WHEN count(*) FILTER (WHERE status IN ('WIN','LOSS')) > 0
            THEN round(count(*) FILTER (WHERE status = 'WIN')::numeric /
                   count(*) FILTER (WHERE status IN ('WIN','LOSS'))::numeric * 100, 1)
            ELSE 0 END AS win_rate,
          CASE WHEN count(*) FILTER (WHERE status IN ('WIN','LOSS')) > 0
            THEN round(avg(CASE WHEN status IN ('WIN','LOSS') THEN
                   (model_probability - (CASE WHEN status = 'WIN' THEN 1 ELSE 0 END))^2
                 END)::numeric, 4)
            ELSE NULL END AS brier
        FROM market_tape
        ${where}
      `;
      const agg = await sql.query(aggQuery, params);

      // Get calibration buckets (predicted prob vs actual hit rate)
      const calQuery = `
        SELECT
          floor(model_probability * 10)::int AS bucket,
          count(*)::int AS n,
          count(*) FILTER (WHERE status = 'WIN')::int AS hits,
          round(avg(model_probability)::numeric, 3) AS avg_prob,
          CASE WHEN count(*) > 0
            THEN round(count(*) FILTER (WHERE status = 'WIN')::numeric / count(*)::numeric, 3)
            ELSE 0 END AS actual_rate
        FROM market_tape
        ${where} ${conditions.length ? "AND" : "WHERE"} status IN ('WIN','LOSS')
        GROUP BY 1
        ORDER BY 1
      `;
      const calBuckets = await sql.query(calQuery, params);

      // Get rows for the table
      const rowsQuery = `
        SELECT id, selection, sport, home, away, market_type, side, line,
               price, model_probability, edge, status, result_home, result_away,
               graded_at, snapped_at, start, event_id, phase, in_play,
               bucket, autopsy_note, snapshot
        FROM market_tape
        ${where}
        ORDER BY snapped_at DESC
        LIMIT 50 OFFSET $${pIdx}
      `;
      const rows = await sql.query(rowsQuery, [...params, offset]);

      // Get breakdown by sport
      const sportBreakdown = await sql.query(`
        SELECT sport,
          count(*) FILTER (WHERE status = 'WIN')::int AS wins,
          count(*) FILTER (WHERE status = 'LOSS')::int AS losses,
          count(*)::int AS total
        FROM market_tape
        ${where} ${conditions.length ? "AND" : "WHERE"} status IN ('WIN','LOSS')
        GROUP BY sport ORDER BY total DESC
      `, params);

      // Get breakdown by market type
      const marketBreakdown = await sql.query(`
        SELECT market_type,
          count(*) FILTER (WHERE status = 'WIN')::int AS wins,
          count(*) FILTER (WHERE status = 'LOSS')::int AS losses,
          count(*)::int AS total
        FROM market_tape
        ${where} ${conditions.length ? "AND" : "WHERE"} status IN ('WIN','LOSS')
        GROUP BY market_type ORDER BY total DESC
      `, params);

      return {
        ok: true,
        aggregates: agg[0] || {},
        calibration: calBuckets,
        sportBreakdown,
        marketBreakdown,
        rows: rows.map((r: any) => ({
          id: r.id,
          selection: r.selection,
          sport: r.sport,
          home: r.home,
          away: r.away,
          marketType: r.market_type,
          side: r.side,
          line: r.line != null ? Number(r.line) : null,
          price: r.price,
          modelProb: r.model_probability != null ? Number(r.model_probability) : null,
          edge: r.edge != null ? Number(r.edge) : null,
          status: r.status || "PENDING",
          resultHome: r.result_home,
          resultAway: r.result_away,
          gradedAt: r.graded_at ? String(r.graded_at) : null,
          snappedAt: String(r.snapped_at),
          start: r.start ? String(r.start) : null,
          // Extended data for raw view
          eventId: r.event_id || null,
          phase: r.phase || null,
          inPlay: r.in_play || false,
          bucket: r.bucket || null,
          autopsyNote: r.autopsy_note || null,
          snapshot: r.snapshot || null,
        })),
      };
    } catch (e: any) {
      return { ok: false, aggregates: {}, calibration: [], sportBreakdown: [], marketBreakdown: [], rows: [], error: String(e) };
    }
  });

/** Get the latest post-grade analysis results for the Dashboard */
export const getLatestAnalysisFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await assertAdmin(context.userId);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const rows = await sql.query(
        `SELECT data, created_at FROM brain_analysis_log
         WHERE analysis_type = 'post_grade'
         ORDER BY created_at DESC LIMIT 1`,
      );
      if (rows.length === 0) return { ok: true, data: null, lastRun: null };
      return {
        ok: true,
        data: rows[0].data,
        lastRun: String(rows[0].created_at),
      };
    } catch {
      return { ok: true, data: null, lastRun: null };
    }
  });

/** Admin: Trigger post-grade analysis manually */
export const runAnalysisFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await assertAdmin(context.userId);
      const { runPostGradeAnalysis } = await import("@/lib/market/post-grade-analysis");
      return runPostGradeAnalysis();
    } catch (e: any) {
      return { ok: false, segmentBrier: [], calibrationDrift: null, edgeProfitability: [], timestamp: "", error: String(e) };
    }
  });
