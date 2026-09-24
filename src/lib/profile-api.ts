import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type RiskProfileMode = "conservative" | "balanced" | "aggressive";

export interface UserProfileData {
  profile: {
    id: string;
    userId: string;
    displayName: string;
    avatarUrl: string;
    createdAt: string;
  };
  preferences: {
    totalBankroll: number;
    baseUnitSize: number;
    riskProfileMode: RiskProfileMode;
    defaultSportsbook: string;
    favoriteTeams: string[];
    favoriteLeagues: string[];
  };
  notifications: {
    steamAlerts: boolean;
    goldDropAlerts: boolean;
    hedgeWarnings: boolean;
    dailyRecapAlerts: boolean;
  };
  sportsbooks: Array<{
    sportsbookId: string;
    isActive: boolean;
  }>;
}

export const getUserProfileDataFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UserProfileData> => {
    const sql = await getSql();
    const userId = context.userId || "dev-user";

    // 1. Ensure Profile Exists
    let profiles = await sql<any>`
      SELECT id, user_id, display_name, avatar_url, created_at 
      FROM user_profiles 
      WHERE user_id = ${userId} 
      LIMIT 1
    `;

    if (!profiles.length) {
      await sql`
        INSERT INTO user_profiles (id, user_id, display_name, avatar_url)
        VALUES (${`profile-${userId}`}, ${userId}, 'Quant Desk Lead', 'https://api.dicebear.com/7.x/bottts/svg?seed=SportsLock')
        ON CONFLICT (user_id) DO NOTHING
      `;
      profiles = await sql<any>`
        SELECT id, user_id, display_name, avatar_url, created_at 
        FROM user_profiles 
        WHERE user_id = ${userId} 
        LIMIT 1
      `;
    }

    // 2. Ensure Preferences Exist
    let prefs = await sql<any>`
      SELECT total_bankroll, base_unit_size, risk_profile_mode, default_sportsbook, favorite_teams, favorite_leagues
      FROM user_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (!prefs.length) {
      await sql`
        INSERT INTO user_preferences (id, user_id, total_bankroll, base_unit_size, risk_profile_mode, default_sportsbook)
        VALUES (${`pref-${userId}`}, ${userId}, 1000.00, 25.00, 'balanced', 'hardrockbet_fl')
        ON CONFLICT (user_id) DO NOTHING
      `;
      prefs = await sql<any>`
        SELECT total_bankroll, base_unit_size, risk_profile_mode, default_sportsbook, favorite_teams, favorite_leagues
        FROM user_preferences
        WHERE user_id = ${userId}
        LIMIT 1
      `;
    }

    // 3. Ensure Notifications Exist
    let notifs = await sql<any>`
      SELECT steam_alerts, gold_drop_alerts, hedge_warnings, daily_recap_alerts
      FROM notification_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (!notifs.length) {
      await sql`
        INSERT INTO notification_settings (id, user_id, steam_alerts, gold_drop_alerts, hedge_warnings, daily_recap_alerts)
        VALUES (${`notif-${userId}`}, ${userId}, TRUE, TRUE, TRUE, TRUE)
        ON CONFLICT (user_id) DO NOTHING
      `;
      notifs = await sql<any>`
        SELECT steam_alerts, gold_drop_alerts, hedge_warnings, daily_recap_alerts
        FROM notification_settings
        WHERE user_id = ${userId}
        LIMIT 1
      `;
    }

    // 4. Books
    let books = await sql<any>`
      SELECT sportsbook_id, is_active
      FROM user_book_accounts
      WHERE user_id = ${userId}
    `;

    if (!books.length) {
      await sql`
        INSERT INTO user_book_accounts (id, user_id, sportsbook_id, is_active)
        VALUES 
          (${`book-${userId}-hardrock`}, ${userId}, 'hardrockbet_fl', TRUE),
          (${`book-${userId}-draftkings`}, ${userId}, 'draftkings', TRUE),
          (${`book-${userId}-fanduel`}, ${userId}, 'fanduel', TRUE)
        ON CONFLICT (user_id, sportsbook_id) DO NOTHING
      `;
      books = await sql<any>`
        SELECT sportsbook_id, is_active
        FROM user_book_accounts
        WHERE user_id = ${userId}
      `;
    }

    const p = profiles[0] || {};
    const pr = prefs[0] || {};
    const n = notifs[0] || {};

    return {
      profile: {
        id: String(p.id || `profile-${userId}`),
        userId: String(p.user_id || userId),
        displayName: String(p.display_name || "Quant Desk Lead"),
        avatarUrl: String(p.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=SportsLock"),
        createdAt: String(p.created_at || new Date().toISOString()),
      },
      preferences: {
        totalBankroll: Number(pr.total_bankroll || 1000.00),
        baseUnitSize: Number(pr.base_unit_size || 25.00),
        riskProfileMode: (pr.risk_profile_mode as RiskProfileMode) || "balanced",
        defaultSportsbook: String(pr.default_sportsbook || "hardrockbet_fl"),
        favoriteTeams: Array.isArray(pr.favorite_teams) ? pr.favorite_teams : [],
        favoriteLeagues: Array.isArray(pr.favorite_leagues) ? pr.favorite_leagues : ["NFL", "NBA", "MLB"],
      },
      notifications: {
        steamAlerts: Boolean(n.steam_alerts ?? true),
        goldDropAlerts: Boolean(n.gold_drop_alerts ?? true),
        hedgeWarnings: Boolean(n.hedge_warnings ?? true),
        dailyRecapAlerts: Boolean(n.daily_recap_alerts ?? true),
      },
      sportsbooks: books.map((b) => ({
        sportsbookId: String(b.sportsbook_id),
        isActive: Boolean(b.is_active),
      })),
    };
  });

export const updateUserProfileFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { displayName?: string; avatarUrl?: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const userId = context.userId || "dev-user";
    await sql`
      INSERT INTO user_profiles (id, user_id, display_name, avatar_url)
      VALUES (${`profile-${userId}`}, ${userId}, ${data.displayName || 'Quant Desk Lead'}, ${data.avatarUrl || ''})
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = COALESCE(${data.displayName}, user_profiles.display_name),
        avatar_url = COALESCE(${data.avatarUrl}, user_profiles.avatar_url)
    `;
    return { ok: true };
  });

export const updateUserPreferencesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    totalBankroll?: number;
    baseUnitSize?: number;
    riskProfileMode?: RiskProfileMode;
    defaultSportsbook?: string;
    favoriteTeams?: string[];
    favoriteLeagues?: string[];
  }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const userId = context.userId || "dev-user";
    await sql`
      INSERT INTO user_preferences (id, user_id, total_bankroll, base_unit_size, risk_profile_mode, default_sportsbook, favorite_teams, favorite_leagues, updated_at)
      VALUES (
        ${`pref-${userId}`},
        ${userId},
        ${data.totalBankroll ?? 1000.00},
        ${data.baseUnitSize ?? 25.00},
        ${data.riskProfileMode ?? 'balanced'},
        ${data.defaultSportsbook ?? 'hardrockbet_fl'},
        ${JSON.stringify(data.favoriteTeams ?? [])}::jsonb,
        ${JSON.stringify(data.favoriteLeagues ?? ["NFL", "NBA", "MLB"])}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        total_bankroll = COALESCE(${data.totalBankroll}, user_preferences.total_bankroll),
        base_unit_size = COALESCE(${data.baseUnitSize}, user_preferences.base_unit_size),
        risk_profile_mode = COALESCE(${data.riskProfileMode}, user_preferences.risk_profile_mode),
        default_sportsbook = COALESCE(${data.defaultSportsbook}, user_preferences.default_sportsbook),
        favorite_teams = COALESCE(${data.favoriteTeams ? JSON.stringify(data.favoriteTeams) : null}::jsonb, user_preferences.favorite_teams),
        favorite_leagues = COALESCE(${data.favoriteLeagues ? JSON.stringify(data.favoriteLeagues) : null}::jsonb, user_preferences.favorite_leagues),
        updated_at = NOW()
    `;
    return { ok: true };
  });

export const updateNotificationSettingsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    steamAlerts?: boolean;
    goldDropAlerts?: boolean;
    hedgeWarnings?: boolean;
    dailyRecapAlerts?: boolean;
  }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const userId = context.userId || "dev-user";
    await sql`
      INSERT INTO notification_settings (id, user_id, steam_alerts, gold_drop_alerts, hedge_warnings, daily_recap_alerts)
      VALUES (
        ${`notif-${userId}`},
        ${userId},
        ${data.steamAlerts ?? true},
        ${data.goldDropAlerts ?? true},
        ${data.hedgeWarnings ?? true},
        ${data.dailyRecapAlerts ?? true}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        steam_alerts = COALESCE(${data.steamAlerts}, notification_settings.steam_alerts),
        gold_drop_alerts = COALESCE(${data.goldDropAlerts}, notification_settings.gold_drop_alerts),
        hedge_warnings = COALESCE(${data.hedgeWarnings}, notification_settings.hedge_warnings),
        daily_recap_alerts = COALESCE(${data.dailyRecapAlerts}, notification_settings.daily_recap_alerts)
    `;
    return { ok: true };
  });

export const toggleUserBookAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { sportsbookId: string; isActive: boolean }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const userId = context.userId || "dev-user";
    await sql`
      INSERT INTO user_book_accounts (id, user_id, sportsbook_id, is_active)
      VALUES (${`book-${userId}-${data.sportsbookId}`}, ${userId}, ${data.sportsbookId}, ${data.isActive})
      ON CONFLICT (user_id, sportsbook_id) DO UPDATE SET
        is_active = ${data.isActive}
    `;
    return { ok: true };
  });
