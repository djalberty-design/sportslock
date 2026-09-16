create table if not exists prediction_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  selection text not null,
  market_type text not null,
  line numeric,
  price integer not null,
  model_probability numeric not null,
  edge numeric not null,
  snapshot jsonb not null,
  status text not null default 'PENDING',
  actual_result jsonb,
  ai_autopsy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prediction_logs_event_id_idx on prediction_logs (event_id);
create index if not exists prediction_logs_status_idx on prediction_logs (status);