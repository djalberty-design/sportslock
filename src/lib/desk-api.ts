import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { OWNER_ADMIN_EMAIL, isAdminEmail, looksLikeEmail, normalizeEmail, roleOf, type DeskRole } from "@/lib/admin";
import {
  DEFAULT_DESK_SETTINGS,
  clampComboCap,
  clampKelly,
  clampSafestFloor,
  parseSportFeeds,
  type DeskSettings,
} from "@/lib/desk-settings";
import type { BetLedgerEntry, LedgerResult } from "@/lib/ledger";

export type AccessStatus = "approved" | "pending" | "denied";

export type AccessState = {
  status: AccessStatus;
  role: DeskRole;
  email: string;
  name: string;
  requestStatus: "none" | "pending" | "approved" | "denied";
};

export type AllowlistRow = { email: string; role: DeskRole; createdAt: string };
export type AccessRequestRow = {
  id: number;
  userId: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
};

export type LedgerBetRow = BetLedgerEntry & { userId: string; userEmail?: string };

export type FeedPing = { ok: boolean; ms: number; status: number };

export type FeedHealth = {
  espn: FeedPing;
  kalshi: FeedPing;
  polymarket: FeedPing;
  asOf: string;
};

export type LedgerAnalytics = {
  tickets: number;
  pending: number;
  hits: number;
  misses: number;
  pushes: number;
  stake: number;
  hitRate: number | null;
};

type UserRow = { email: string | null; name: string | null };

async function loadUser(userId: string): Promise<UserRow> {
  const sql = await getSql();
  const rows = await sql<UserRow>`select email, name from "user" where id = ${userId} limit 1`;
  return rows[0] ?? { email: null, name: null };
}

async function ensureAllowlistSeed(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`insert into desk_allowlist (email, role) values (${OWNER_ADMIN_EMAIL}, 'admin') on conflict (email) do nothing`;
  await sql`insert into desk_settings (id) values (1) on conflict (id) do nothing`;
}

async function listedRole(sql: Awaited<ReturnType<typeof getSql>>, email: string): Promise<DeskRole | null> {
  const rows = await sql<{ role: string }>`select role from desk_allowlist where email = ${email} limit 1`;
  const role = rows[0]?.role;
  if (role === "admin" || role === "user") return role;
  return null;
}

async function requireAdmin(userId: string): Promise<{ email: string; name: string }> {
  const user = await loadUser(userId);
  const email = normalizeEmail(user.email);
  const sql = await getSql();
  await ensureAllowlistSeed(sql);
  const listed = email ? await listedRole(sql, email) : null;
  if (roleOf(email, listed) !== "admin") {
    throw new Error("Forbidden");
  }
  return { email, name: user.name ?? "" };
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) return v;
  return new Date().toISOString();
}

function mapLedger(r: {
  id: string;
  user_id: string;
  timestamp: unknown;
  sport: string;
  market_type: string;
  home: string;
  away: string;
  ticket_name: string;
  hard_rock_odds: unknown;
  desk_true_probability: unknown;
  expected_edge_pct: unknown;
  stake_dollars: unknown;
  result: string;
  post_mortem_notes: string | null;
  layer_snapshots: unknown;
  email?: string | null;
}): LedgerBetRow {
  let layers: Record<string, number> = {};
  if (r.layer_snapshots && typeof r.layer_snapshots === "object") {
    layers = r.layer_snapshots as Record<string, number>;
  } else if (typeof r.layer_snapshots === "string") {
    try {
      layers = JSON.parse(r.layer_snapshots) as Record<string, number>;
    } catch {
      layers = {};
    }
  }
  const result = (["PENDING", "HIT", "MISS", "PUSH"].includes(r.result) ? r.result : "PENDING") as LedgerResult;
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.email ?? undefined,
    timestamp: asIso(r.timestamp),
    sport: r.sport ?? "",
    marketType: (r.market_type as BetLedgerEntry["marketType"]) || "MONEYLINE",
    teams: { home: r.home ?? "", away: r.away ?? "" },
    ticketName: r.ticket_name,
    hardRockOdds: num(r.hard_rock_odds, 0),
    deskTrueProbability: num(r.desk_true_probability, 0),
    expectedEdgePct: num(r.expected_edge_pct, 0),
    stakeDollars: num(r.stake_dollars, 0),
    result,
    postMortemNotes: r.post_mortem_notes ?? undefined,
    layerSnapshots: layers,
  };
}

export function analyticsOf(rows: Array<{ result: string; stakeDollars: number }>): LedgerAnalytics {
  const pending = rows.filter((r) => r.result === "PENDING").length;
  const hits = rows.filter((r) => r.result === "HIT").length;
  const misses = rows.filter((r) => r.result === "MISS").length;
  const pushes = rows.filter((r) => r.result === "PUSH").length;
  const decided = hits + misses;
  return {
    tickets: rows.length,
    pending,
    hits,
    misses,
    pushes,
    stake: rows.reduce((n, r) => n + (Number(r.stakeDollars) || 0), 0),
    hitRate: decided ? hits / decided : null,
  };
}

async function fetchAllowlist(): Promise<AllowlistRow[]> {
  const sql = await getSql();
  const rows = await sql<{ email: string; role: string; created_at: unknown }>`
    select email, role, created_at from desk_allowlist order by role desc, email asc
  `;
  return rows.map((r) => ({
    email: r.email,
    role: r.role === "admin" ? "admin" : "user",
    createdAt: asIso(r.created_at),
  }));
}

async function fetchAccessRequests(): Promise<AccessRequestRow[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    user_id: string;
    email: string;
    name: string | null;
    status: string;
    created_at: unknown;
  }>`select id, user_id, email, name, status, created_at from desk_access_requests order by created_at desc`;
  return rows.map((r) => ({
    id: Number(r.id),
    userId: r.user_id,
    email: r.email,
    name: r.name,
    status: r.status,
    createdAt: asIso(r.created_at),
  }));
}

async function fetchMasterLedger(): Promise<{ rows: LedgerBetRow[]; analytics: LedgerAnalytics }> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    user_id: string;
    timestamp: unknown;
    sport: string;
    market_type: string;
    home: string;
    away: string;
    ticket_name: string;
    hard_rock_odds: unknown;
    desk_true_probability: unknown;
    expected_edge_pct: unknown;
    stake_dollars: unknown;
    result: string;
    post_mortem_notes: string | null;
    layer_snapshots: unknown;
    email: string | null;
  }>`
    select b.id, b.user_id, b.timestamp, b.sport, b.market_type, b.home, b.away, b.ticket_name,
           b.hard_rock_odds, b.desk_true_probability, b.expected_edge_pct, b.stake_dollars,
           b.result, b.post_mortem_notes, b.layer_snapshots, u.email
    from desk_ledger_bets b
    left join "user" u on u.id = b.user_id
    order by b.timestamp desc
    limit 400
  `;
  const mapped = rows.map(mapLedger);
  return { rows: mapped, analytics: analyticsOf(mapped) };
}

async function fetchHiddenIds(): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ pick_id: string }>`select pick_id from desk_hidden_picks`;
  return rows.map((r) => r.pick_id);
}

export const getAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AccessState> => {
    const sql = await getSql();
    await ensureAllowlistSeed(sql);
    const user = await loadUser(context.userId);
    const email = normalizeEmail(user.email);
    const name = user.name ?? "";
    if (!email) {
      return { status: "pending", role: "user", email: "", name, requestStatus: "none" };
    }
    if (isAdminEmail(email)) {
      await sql`insert into desk_allowlist (email, role) values (${email}, 'admin') on conflict (email) do update set role = 'admin'`;
      return { status: "approved", role: "admin", email, name, requestStatus: "approved" };
    }
    const listed = await listedRole(sql, email);
    const req = await sql<{ status: string }>`select status from desk_access_requests where email = ${email} limit 1`;
    const requestStatus = (req[0]?.status as AccessState["requestStatus"]) || "none";
    if (listed) {
      return { status: "approved", role: roleOf(email, listed), email, name, requestStatus: "approved" };
    }
    if (requestStatus === "denied") {
      return { status: "denied", role: "user", email, name, requestStatus: "denied" };
    }
    return { status: "pending", role: "user", email, name, requestStatus: requestStatus === "pending" ? "pending" : "none" };
  });

export const requestAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AccessState> => {
    const sql = await getSql();
    await ensureAllowlistSeed(sql);
    const user = await loadUser(context.userId);
    const email = normalizeEmail(user.email);
    const name = user.name ?? "";
    if (!email) {
      return { status: "pending", role: "user", email: "", name, requestStatus: "none" };
    }
    if (isAdminEmail(email)) {
      await sql`insert into desk_allowlist (email, role) values (${email}, 'admin') on conflict (email) do update set role = 'admin'`;
      return { status: "approved", role: "admin", email, name, requestStatus: "approved" };
    }
    const listed = await listedRole(sql, email);
    if (listed) {
      return { status: "approved", role: roleOf(email, listed), email, name, requestStatus: "approved" };
    }
    await sql`
      insert into desk_access_requests (user_id, email, name, status, updated_at)
      values (${context.userId}, ${email}, ${name || null}, 'pending', now())
      on conflict (email) do update set
        user_id = excluded.user_id,
        name = excluded.name,
        status = case when desk_access_requests.status = 'denied' then 'pending' else desk_access_requests.status end,
        updated_at = now()
    `;
    return { status: "pending", role: "user", email, name, requestStatus: "pending" };
  });

export const getDeskSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskSettings> => {
    const sql = await getSql();
    await ensureAllowlistSeed(sql);
    const user = await loadUser(context.userId);
    const email = normalizeEmail(user.email);
    const listed = email ? await listedRole(sql, email) : null;
    if (roleOf(email, listed) === "user" && !listed && !isAdminEmail(email)) {
      return DEFAULT_DESK_SETTINGS;
    }
    const rows = await sql<{
      safest_floor: unknown;
      kelly_multiplier: unknown;
      sport_feeds: unknown;
      combo_leg_cap: unknown;
      pinned_pick_id: string | null;
    }>`select safest_floor, kelly_multiplier, sport_feeds, combo_leg_cap, pinned_pick_id from desk_settings where id = 1`;
    const row = rows[0];
    if (!row) return DEFAULT_DESK_SETTINGS;
    return {
      safestFloor: clampSafestFloor(num(row.safest_floor, DEFAULT_DESK_SETTINGS.safestFloor)),
      kellyMultiplier: clampKelly(num(row.kelly_multiplier, DEFAULT_DESK_SETTINGS.kellyMultiplier)),
      comboLegCap: clampComboCap(num(row.combo_leg_cap, DEFAULT_DESK_SETTINGS.comboLegCap)),
      sportFeeds: parseSportFeeds(row.sport_feeds),
      pinnedPickId: row.pinned_pick_id || null,
    };
  });

export const saveDeskSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: Partial<DeskSettings>) => d)
  .handler(async ({ context, data }): Promise<DeskSettings> => {
    const { email } = await requireAdmin(context.userId);
    const sql = await getSql();
    const currentRows = await sql<{
      safest_floor: unknown;
      kelly_multiplier: unknown;
      sport_feeds: unknown;
      combo_leg_cap: unknown;
      pinned_pick_id: string | null;
    }>`select safest_floor, kelly_multiplier, sport_feeds, combo_leg_cap, pinned_pick_id from desk_settings where id = 1`;
    const cur = currentRows[0];
    const next: DeskSettings = {
      safestFloor: clampSafestFloor(data.safestFloor ?? num(cur?.safest_floor, DEFAULT_DESK_SETTINGS.safestFloor)),
      kellyMultiplier: clampKelly(data.kellyMultiplier ?? num(cur?.kelly_multiplier, DEFAULT_DESK_SETTINGS.kellyMultiplier)),
      comboLegCap: clampComboCap(data.comboLegCap ?? num(cur?.combo_leg_cap, DEFAULT_DESK_SETTINGS.comboLegCap)),
      sportFeeds: data.sportFeeds ? parseSportFeeds(data.sportFeeds) : parseSportFeeds(cur?.sport_feeds),
      pinnedPickId: data.pinnedPickId === undefined ? cur?.pinned_pick_id || null : data.pinnedPickId,
    };
    const feedsJson = JSON.stringify(next.sportFeeds);
    await sql`
      insert into desk_settings (id, safest_floor, kelly_multiplier, sport_feeds, combo_leg_cap, pinned_pick_id, updated_at, updated_by)
      values (1, ${next.safestFloor}, ${next.kellyMultiplier}, ${feedsJson}::jsonb, ${next.comboLegCap}, ${next.pinnedPickId}, now(), ${email})
      on conflict (id) do update set
        safest_floor = excluded.safest_floor,
        kelly_multiplier = excluded.kelly_multiplier,
        sport_feeds = excluded.sport_feeds,
        combo_leg_cap = excluded.combo_leg_cap,
        pinned_pick_id = excluded.pinned_pick_id,
        updated_at = now(),
        updated_by = excluded.updated_by
    `;
    return next;
  });

export const listAllowlist = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AllowlistRow[]> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await ensureAllowlistSeed(sql);
    return fetchAllowlist();
  });

export const addAllowlistEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { email: string; role?: DeskRole }) => d)
  .handler(async ({ context, data }): Promise<AllowlistRow[]> => {
    const { email: actor } = await requireAdmin(context.userId);
    const email = normalizeEmail(data.email);
    if (!looksLikeEmail(email)) throw new Error("That does not look like an email.");
    const role: DeskRole = isAdminEmail(email) ? "admin" : data.role === "admin" ? "admin" : "user";
    const sql = await getSql();
    await sql`
      insert into desk_allowlist (email, role, created_by)
      values (${email}, ${role}, ${actor})
      on conflict (email) do update set role = excluded.role
    `;
    await sql`update desk_access_requests set status = 'approved', updated_at = now() where email = ${email}`;
    return fetchAllowlist();
  });

export const revokeAllowlistEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { email: string }) => d)
  .handler(async ({ context, data }): Promise<AllowlistRow[]> => {
    await requireAdmin(context.userId);
    const email = normalizeEmail(data.email);
    if (isAdminEmail(email)) throw new Error("The super admin cannot be revoked.");
    const sql = await getSql();
    await sql`delete from desk_allowlist where email = ${email}`;
    await sql`update desk_access_requests set status = 'denied', updated_at = now() where email = ${email}`;
    return fetchAllowlist();
  });

export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AccessRequestRow[]> => {
    await requireAdmin(context.userId);
    return fetchAccessRequests();
  });

export const decideAccessRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { email: string; approve: boolean }) => d)
  .handler(async ({ context, data }): Promise<AccessRequestRow[]> => {
    const { email: actor } = await requireAdmin(context.userId);
    const email = normalizeEmail(data.email);
    const sql = await getSql();
    if (data.approve) {
      await sql`
        insert into desk_allowlist (email, role, created_by)
        values (${email}, 'user', ${actor})
        on conflict (email) do nothing
      `;
      await sql`update desk_access_requests set status = 'approved', updated_at = now() where email = ${email}`;
    } else {
      if (isAdminEmail(email)) throw new Error("The super admin cannot be denied.");
      await sql`delete from desk_allowlist where email = ${email}`;
      await sql`update desk_access_requests set status = 'denied', updated_at = now() where email = ${email}`;
    }
    try {
      const { logActivity } = await import("@/lib/market/activity");
      void logActivity("access", data.approve ? "User approved" : "User denied", `${email} (by ${actor})`, "admin");
    } catch {}
    return fetchAccessRequests();
  });

export const listHiddenPicks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<string[]> => {
    const sql = await getSql();
    const user = await loadUser(context.userId);
    const email = normalizeEmail(user.email);
    const listed = email ? await listedRole(sql, email) : null;
    if (!listed && !isAdminEmail(email)) return [];
    return fetchHiddenIds();
  });

export const hidePickRemote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pickId: string; hide: boolean }) => d)
  .handler(async ({ context, data }): Promise<string[]> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const id = String(data.pickId || "").trim();
    if (!id) return fetchHiddenIds();
    if (data.hide) {
      await sql`insert into desk_hidden_picks (pick_id, hidden_by) values (${id}, ${context.userId}) on conflict (pick_id) do nothing`;
    } else {
      await sql`delete from desk_hidden_picks where pick_id = ${id}`;
    }
    return fetchHiddenIds();
  });

export const pullMyLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BetLedgerEntry[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      user_id: string;
      timestamp: unknown;
      sport: string;
      market_type: string;
      home: string;
      away: string;
      ticket_name: string;
      hard_rock_odds: unknown;
      desk_true_probability: unknown;
      expected_edge_pct: unknown;
      stake_dollars: unknown;
      result: string;
      post_mortem_notes: string | null;
      layer_snapshots: unknown;
    }>`select id, user_id, timestamp, sport, market_type, home, away, ticket_name, hard_rock_odds, desk_true_probability, expected_edge_pct, stake_dollars, result, post_mortem_notes, layer_snapshots from desk_ledger_bets where user_id = ${context.userId} order by timestamp desc`;
    return rows.map(mapLedger);
  });

export const pushMyLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { entries: BetLedgerEntry[] }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; count: number }> => {
    const sql = await getSql();
    const entries = Array.isArray(data.entries) ? data.entries.slice(0, 400) : [];
    for (const e of entries) {
      if (!e?.id) continue;
      const layers = JSON.stringify(e.layerSnapshots ?? {});
      await sql`
        insert into desk_ledger_bets (
          id, user_id, timestamp, sport, market_type, home, away, ticket_name,
          hard_rock_odds, desk_true_probability, expected_edge_pct, stake_dollars,
          result, post_mortem_notes, layer_snapshots, updated_at
        ) values (
          ${e.id}, ${context.userId}, ${e.timestamp}, ${e.sport ?? ""}, ${e.marketType},
          ${e.teams?.home ?? ""}, ${e.teams?.away ?? ""}, ${e.ticketName},
          ${e.hardRockOdds ?? 0}, ${e.deskTrueProbability ?? 0}, ${e.expectedEdgePct ?? 0},
          ${e.stakeDollars ?? 0}, ${e.result ?? "PENDING"}, ${e.postMortemNotes ?? null},
          ${layers}::jsonb, now()
        )
        on conflict (id) do update set
          timestamp = excluded.timestamp,
          sport = excluded.sport,
          market_type = excluded.market_type,
          home = excluded.home,
          away = excluded.away,
          ticket_name = excluded.ticket_name,
          hard_rock_odds = excluded.hard_rock_odds,
          desk_true_probability = excluded.desk_true_probability,
          expected_edge_pct = excluded.expected_edge_pct,
          stake_dollars = excluded.stake_dollars,
          result = excluded.result,
          post_mortem_notes = excluded.post_mortem_notes,
          layer_snapshots = excluded.layer_snapshots,
          updated_at = now()
        where desk_ledger_bets.user_id = ${context.userId}
      `;
    }
    return { ok: true, count: entries.length };
  });

export const listMasterLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ rows: LedgerBetRow[]; analytics: LedgerAnalytics }> => {
    await requireAdmin(context.userId);
    return fetchMasterLedger();
  });

export const updateLedgerBet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; result?: LedgerResult; notes?: string; delete?: boolean }) => d)
  .handler(async ({ context, data }): Promise<{ rows: LedgerBetRow[]; analytics: LedgerAnalytics }> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const id = String(data.id || "").trim();
    if (id && data.delete) {
      await sql`delete from desk_ledger_bets where id = ${id}`;
    } else if (id && data.result) {
      await sql`
        update desk_ledger_bets
        set result = ${data.result},
            post_mortem_notes = coalesce(${data.notes ?? null}, post_mortem_notes),
            updated_at = now()
        where id = ${id}
      `;
    }
    return fetchMasterLedger();
  });

export const getFeedHealth = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FeedHealth> => {
    await requireAdmin(context.userId);
    const ping = async (url: string): Promise<FeedPing> => {
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SportsLock/1.0)", Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        return { ok: res.ok, ms: Date.now() - t0, status: res.status };
      } catch {
        return { ok: false, ms: Date.now() - t0, status: 0 };
      }
    };
    const [espn, kalshi, polymarket] = await Promise.all([
      ping("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"),
      ping("https://api.elections.kalshi.com/trade-api/v2/exchange/status"),
      ping("https://gamma-api.polymarket.com/sports"),
    ]);
    return { espn, kalshi, polymarket, asOf: new Date().toISOString() };
  });
