create table if not exists market_tape (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  sport text,
  home text,
  away text,
  start timestamptz,
  market_type text not null,
  side text,
  selection text not null,
  line numeric,
  price integer,
  model_probability numeric,
  edge numeric,
  phase text not null,
  in_play boolean not null default false,
  complete boolean not null default false,
  home_score integer,
  away_score integer,
  period text,
  clock text,
  status_text text,
  snapped_at timestamptz not null default now(),
  snapshot jsonb
);

create index if not exists market_tape_event_idx on market_tape (event_id, market_type, side, snapped_at desc);
create index if not exists market_tape_phase_idx on market_tape (phase, snapped_at desc);
