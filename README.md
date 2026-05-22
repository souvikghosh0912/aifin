# finai — AI Finance Dashboard

A production-ready Next.js dashboard for tracking **NSE & BSE** equities with AI-ready hooks for chat, forecasts, and generative reports.

- **Stack**: Next.js 15 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind + shadcn/ui · TanStack Query · Recharts · `nse-bse-api`
- **Auth**: Email/password via Supabase SSR (`@supabase/ssr`, `auth.getClaims()`)
- **Live data**: NSE/BSE quotes through `nse-bse-api`, cached in memory + Postgres with a token-bucket rate limiter
- **AI**: Provider seam + UI scaffolding shipped. Drop in `ANTHROPIC_API_KEY` and implement `src/lib/ai/provider.ts` to enable.

## Quick start

### 1. Install

```bash
npm install
```

### 2. Set up Supabase

Create a project at [supabase.com](https://supabase.com), then:

```bash
# Apply the schema (or paste supabase/migrations/0001_init.sql into the SQL editor)
npx supabase link --project-ref <your-ref>
npx supabase db push
```

Or copy the contents of `supabase/migrations/0001_init.sql` into the dashboard SQL editor.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **server-only** |
| `ANTHROPIC_API_KEY` | leave blank until you wire up AI |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>, sign up, and start adding transactions.

## Architecture

```
src/
  app/
    (auth)/          # login, signup, callback
    (app)/           # protected app — dashboard, holdings, transactions, etc.
    api/
      quote/[symbol]/  # GET single quote (cached)
      quotes/batch/    # POST batch quotes
      search/          # symbol search
      ai/              # 501 stubs until provider.ts is implemented
      health/          # DB + upstream health check
  components/
    ui/              # shadcn primitives
    charts/          # Recharts wrappers
    portfolio/      # holdings, transactions, dashboard summary
    watchlist/, markets/, ai/, layout/
  lib/
    supabase/        # server/client/middleware
    market/          # nse-bse-api wrapper + cache + rate limiter
    portfolio/calc.ts # pure functions (weighted avg cost, XIRR, allocation)
    ai/provider.ts   # **seam — implement this to enable AI**
    validation/      # Zod schemas
supabase/
  migrations/0001_init.sql  # tables, RLS, view, signup trigger
```

### Market data flow

```
Client → /api/quotes/batch → getQuote() → cache.ts
                                            ├─ in-memory LRU (30s)
                                            ├─ Postgres quote_cache (5min)
                                            └─ nse-bse-api (rate-limited 2 req/s)
```

- **In-memory LRU** for ~30s — instant repeat hits.
- **Postgres `quote_cache`** for ~5min — survives cold starts.
- **Token-bucket** at 2 req/sec stays under NSE's ~3 req/sec limit.
- **Coalescing** — concurrent requests for the same symbol share one promise.

### Row-level security

Every user-owned table has RLS policies scoped to `auth.uid() = user_id`. Try it: open two browsers with different accounts and verify each sees only their own holdings.

`quote_cache` denies all client access — only the service-role server code reads/writes it.

## Wiring up AI

Currently `src/lib/ai/provider.ts` exports a `StubProvider` that throws `NotImplementedError`. To enable:

1. Set `ANTHROPIC_API_KEY` in `.env.local`.
2. Replace `StubProvider` with an Anthropic-backed implementation (recommended: enable prompt caching).
3. Update the three route handlers in `src/app/api/ai/{chat,insights,forecast}/route.ts` to invoke the provider instead of returning 501.

The `ai_conversations`, `ai_messages`, and `ai_reports` tables are already in the schema with RLS in place.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Next.js lint |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run db:types` | Regenerate `src/types/database.ts` from Supabase |

## Verification checklist

- [ ] `npm run typecheck` clean
- [ ] Sign up → email confirm → land on `/dashboard`
- [ ] Refresh `/dashboard` → still authenticated
- [ ] `GET /api/quote/RELIANCE?exchange=NSE` returns a quote
- [ ] Repeat call within 30s served from cache (<50 ms)
- [ ] Add a BUY → `/holdings` shows position with live price
- [ ] Second user cannot see first user's data
- [ ] `/api/ai/chat` returns 501 with `ai_not_configured`
- [ ] Mobile: sidebar collapses to bottom nav; tables horizontal-scroll
- [ ] `GET /api/health` returns `{ ok: true }`

## Notes & caveats

- **Quotes are not realtime.** NSE doesn't offer a websocket feed; the dashboard polls every 30s. That's fine for portfolio tracking, not for trading.
- **`nse-bse-api` is unofficial** and scrapes the NSE/BSE public sites. Treat upstream failures as expected and surface them gracefully (the code already does).
- **Single-process rate limiter.** For multi-instance deployments (e.g., multiple Vercel regions), layer Redis on top of `src/lib/market/rate-limit.ts`.
- **INR-only** today. The schema has `base_currency` but UI/calculations assume INR.

## License

MIT
