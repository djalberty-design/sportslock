-- User Profiles, Personalization Preferences, Notifications, and Sportsbook Accounts

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  total_bankroll NUMERIC(12, 2) NOT NULL DEFAULT 1000.00,
  base_unit_size NUMERIC(10, 2) NOT NULL DEFAULT 25.00,
  risk_profile_mode TEXT NOT NULL DEFAULT 'balanced', -- 'conservative' | 'balanced' | 'aggressive'
  default_sportsbook TEXT NOT NULL DEFAULT 'hardrockbet_fl',
  favorite_teams JSONB DEFAULT '[]'::jsonb,
  favorite_leagues JSONB DEFAULT '["NFL", "NBA", "MLB"]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  steam_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  gold_drop_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  hedge_warnings BOOLEAN NOT NULL DEFAULT TRUE,
  daily_recap_alerts BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_book_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  sportsbook_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(user_id, sportsbook_id)
);

-- Seed default profile for dev-user if not exists
INSERT INTO user_profiles (id, user_id, display_name, avatar_url)
VALUES ('profile-dev-user', 'dev-user', 'Quant Desk Lead', 'https://api.dicebear.com/7.x/bottts/svg?seed=SportsLock')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_preferences (id, user_id, total_bankroll, base_unit_size, risk_profile_mode, default_sportsbook)
VALUES ('pref-dev-user', 'dev-user', 1000.00, 25.00, 'balanced', 'hardrockbet_fl')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO notification_settings (id, user_id, steam_alerts, gold_drop_alerts, hedge_warnings, daily_recap_alerts)
VALUES ('notif-dev-user', 'dev-user', TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_book_accounts (id, user_id, sportsbook_id, is_active)
VALUES 
  ('book-dev-hardrock', 'dev-user', 'hardrockbet_fl', TRUE),
  ('book-dev-draftkings', 'dev-user', 'draftkings', TRUE),
  ('book-dev-fanduel', 'dev-user', 'fanduel', TRUE)
ON CONFLICT (user_id, sportsbook_id) DO NOTHING;
