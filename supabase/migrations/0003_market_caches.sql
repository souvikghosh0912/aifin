-- 0003_market_caches.sql
-- Shared cache for historical equity candles. Read/write via service role only.
create table if not exists public.historical_cache (
  symbol     text        not null,
  exchange   text        not null check (exchange in ('NSE', 'BSE')),
  range      text        not null check (range in ('1M', '3M', '6M', '1Y')),
  payload    jsonb       not null,
  fetched_at timestamptz not null default now(),
  primary key (symbol, exchange, range)
);

-- No RLS policies → only the service role can read/write.
alter table public.historical_cache enable row level security;
