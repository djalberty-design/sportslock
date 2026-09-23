-- Migration 0006: Brain Reliability Table, Blend Weights, and Composite Indexes

-- 1. Create brain_reliability_table for persisting empirical calibration curves across serverless instances
CREATE TABLE IF NOT EXISTS brain_reliability_table (
  bucket INTEGER PRIMARY KEY,
  lo NUMERIC NOT NULL,
  hi NUMERIC NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  mean_p NUMERIC NOT NULL DEFAULT 0.5,
  hit_rate NUMERIC NOT NULL DEFAULT 0.5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create brain_model_weights table if not exists (with circuit_breaker source support)
CREATE TABLE IF NOT EXISTS brain_model_weights (
  sport TEXT PRIMARY KEY,
  w_sim NUMERIC NOT NULL,
  w_pool NUMERIC NOT NULL,
  w_market NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'default',
  sample_size INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Composite performance indexes for sub-10ms ledger queries across all tabs
CREATE INDEX IF NOT EXISTS market_tape_sport_status_snapped_idx ON market_tape (sport, status, snapped_at DESC);
CREATE INDEX IF NOT EXISTS market_tape_rec_status_edge_idx ON market_tape (recommended, status, edge DESC);
CREATE INDEX IF NOT EXISTS market_tape_bucket_status_idx ON market_tape (bucket, status);
CREATE INDEX IF NOT EXISTS market_tape_status_snapped_idx ON market_tape (status, snapped_at DESC);
