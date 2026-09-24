-- Migration 0008: Ensure all market_tape and user table columns exist safely
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_tape') THEN
    ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS status text;
    ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS recommended boolean not null default false;
    ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS result_home integer;
    ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS result_away integer;
    ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS graded_at timestamptz;
    ALTER TABLE market_tape ADD COLUMN IF NOT EXISTS bucket integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS market_tape_sport_status_snapped_idx ON market_tape (sport, status, snapped_at DESC);
CREATE INDEX IF NOT EXISTS market_tape_rec_status_edge_idx ON market_tape (recommended, status, edge DESC);
CREATE INDEX IF NOT EXISTS market_tape_bucket_status_idx ON market_tape (bucket, status);
CREATE INDEX IF NOT EXISTS market_tape_status_snapped_idx ON market_tape (status, snapped_at DESC);
