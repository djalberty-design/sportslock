import { getSql } from "@/lib/db";
import { createServerFn } from "@tanstack/react-start";
import { BRAND } from "@/lib/brand";
import { buildLiveSnapshot } from "./live-board";
import { ESPN_PATH, applyLeaderStats, enrichResearchForm, fetchEspnRoster, fetchEspnTeamLeaders, mergeResearchPlayers, parseEspnSummary, parseInternalEventId, type EventResearch } from "./research";
import type { ContestOffer, DeskSnapshot, ParsedTicket } from "./types";
import { resolveVisionKey, VISION_MODELS, VISION_UNAVAILABLE } from "./vision-key";

export const getBoardSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<DeskSnapshot> => {
  try {
    return await buildLiveSnapshot();
  } catch (err: any) {
    console.error("SERVER_SNAPSHOT_FATAL_ERROR:", err);
    return {
      asOf: "",
      delayed: false,
      sample: false,
      hours: { preGameOpen: false, etStamp: 0, etDate: "", nextLock: null, label: "ERROR", note: undefined },
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
Rules: If the photo is a PARLAY, put EVERY leg in fields (2+ objects). confidence 0-1. Never write "ML" in selection — say "to win". Include home, away, and kickoff if visible. Never invent a team, price, or game that is not in the photo. Empty fields array if nothing is readable. Sports: NFL, NBA, MLB, NHL, NCAAF, NCAAB equally.
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
Rules: ticket = Hard Rock / DraftKings odds. slate = player salary list. contest = DFS lobby with buy-ins. Never invent numbers or games you cannot read. Never write "ML" — say "to win". Sports: NFL, NBA, MLB, NHL, NCAAF, NCAAB equally.`;

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



export const getPredictionLogs = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const sql = await getSql();
    const logs = await sql`SELECT * FROM prediction_logs ORDER BY created_at DESC LIMIT 200`;
    return logs;
  } catch (err) {
    console.error("Failed to fetch prediction logs:", err);
    return [];
  }
});