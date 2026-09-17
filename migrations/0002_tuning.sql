CREATE TABLE IF NOT EXISTS desk_tuning_raw (
  id INTEGER PRIMARY KEY,
  min_edge FLOAT,
  kelly FLOAT,
  max_legs INTEGER,
  feeds TEXT
);

INSERT INTO desk_tuning_raw (id, min_edge, kelly, max_legs, feeds)
VALUES (1, 2.5, 0.25, 3, '["espn", "kalshi", "polymarket"]')
ON CONFLICT (id) DO NOTHING;