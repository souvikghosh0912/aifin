-- ============================================================
-- AI Finance Dashboard — initial schema
-- ============================================================
-- All user-owned tables have row-level security enforced.
-- quote_cache is server-only (service-role).
-- ============================================================

-- Enums --------------------------------------------------------
create type public.exchange as enum ('NSE', 'BSE');
create type public.txn_side as enum ('BUY', 'SELL');
create type public.ai_report_kind as enum ('weekly', 'monthly', 'forecast');

-- profiles -----------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  base_currency text not null default 'INR',
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-provision profile + default portfolio on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.portfolios (user_id, name, is_default)
  values (new.id, 'My Portfolio', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- portfolios ---------------------------------------------------
create table public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index portfolios_user_id_idx on public.portfolios (user_id);
create unique index portfolios_one_default_per_user
  on public.portfolios (user_id) where (is_default);

alter table public.portfolios enable row level security;

create policy "portfolios: all own"
  on public.portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transactions -------------------------------------------------
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol       text not null,
  exchange     public.exchange not null,
  side         public.txn_side not null,
  quantity     numeric(20, 4) not null check (quantity > 0),
  price        numeric(20, 4) not null check (price >= 0),
  fees         numeric(20, 4) not null default 0 check (fees >= 0),
  traded_at    timestamptz not null,
  notes        text,
  created_at   timestamptz not null default now()
);
create index transactions_user_id_traded_at_idx
  on public.transactions (user_id, traded_at desc);
create index transactions_user_symbol_idx
  on public.transactions (user_id, symbol, exchange);

alter table public.transactions enable row level security;

create policy "transactions: all own"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- holdings_view -----------------------------------------------
-- Aggregated current positions per user/portfolio/symbol.
-- Uses weighted-average cost basis. Realized P&L is summed from sells.
create or replace view public.holdings_view
with (security_invoker = true) as
with running as (
  select
    user_id,
    portfolio_id,
    symbol,
    exchange,
    sum(case when side = 'BUY' then quantity else -quantity end) as quantity,
    sum(case when side = 'BUY' then quantity * price + fees else 0 end) as gross_buy,
    sum(case when side = 'BUY' then quantity else 0 end) as buy_qty,
    sum(case when side = 'SELL' then quantity * price - fees else 0 end) as gross_sell,
    sum(case when side = 'SELL' then quantity else 0 end) as sell_qty
  from public.transactions
  group by user_id, portfolio_id, symbol, exchange
)
select
  user_id,
  portfolio_id,
  symbol,
  exchange,
  quantity,
  case when buy_qty > 0 then gross_buy / buy_qty else 0 end as avg_cost,
  case when quantity > 0
    then quantity * (case when buy_qty > 0 then gross_buy / buy_qty else 0 end)
    else 0
  end as invested_value,
  gross_sell - (sell_qty * case when buy_qty > 0 then gross_buy / buy_qty else 0 end) as realized_pnl
from running
where quantity > 0;

-- watchlist_items ---------------------------------------------
create table public.watchlist_items (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  symbol    text not null,
  exchange  public.exchange not null,
  added_at  timestamptz not null default now(),
  unique (user_id, symbol, exchange)
);
create index watchlist_items_user_id_idx on public.watchlist_items (user_id);

alter table public.watchlist_items enable row level security;

create policy "watchlist_items: all own"
  on public.watchlist_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- quote_cache (server-only) -----------------------------------
create table public.quote_cache (
  symbol      text not null,
  exchange    public.exchange not null,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  primary key (symbol, exchange)
);

alter table public.quote_cache enable row level security;
-- No policies — only service role can access.

-- ai_conversations --------------------------------------------
create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  created_at  timestamptz not null default now()
);
create index ai_conversations_user_id_idx on public.ai_conversations (user_id);

alter table public.ai_conversations enable row level security;

create policy "ai_conversations: all own"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ai_messages -------------------------------------------------
create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  tokens          integer,
  created_at      timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

alter table public.ai_messages enable row level security;

create policy "ai_messages: access via parent conversation"
  on public.ai_messages for all
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- ai_reports --------------------------------------------------
create table public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          public.ai_report_kind not null,
  content       text not null,
  period_start  date not null,
  period_end    date not null,
  created_at    timestamptz not null default now()
);
create index ai_reports_user_idx on public.ai_reports (user_id, created_at desc);

alter table public.ai_reports enable row level security;

create policy "ai_reports: all own"
  on public.ai_reports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
