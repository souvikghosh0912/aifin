# Stocks detail page — chart, top gainers rail, key details

**Date:** 2026-05-22
**Scope:** `src/app/(app)/stocks/[symbol]/*`, `src/components/stocks/*`, `src/components/markets/symbol-search.tsx`, `src/lib/market/*`, `src/app/api/historical/*`, `supabase/migrations/*`, `src/types/database.ts`
**Status:** spec → plan

## Context

The markets page (`src/app/(app)/markets/page.tsx`) currently lets the user search NSE/BSE symbols (via `SymbolSearch`) and browse indices, but a symbol suggestion has no destination — clicking a hit does nothing. The codebase already has cached quote fetching (`getCachedQuote`), a `/api/quote/[symbol]` route, a `/api/quotes/batch` route, and a `/api/search` route. The `nse-bse-api` package exposes `fetchEquityHistoricalData`, `listEquityStocksByIndex`, `getEquityMetaInfo`, and `getEquityQuote` — all unused so far.

This spec adds a dedicated `/stocks/[symbol]` page where a search suggestion (or any future stock-symbol link) leads. The page shows the company's name and current price, an embedded recharts area chart with switchable 1M/3M/6M/1Y ranges and a "Full Chart →" stub button, plus a right-hand rail containing a stock search input, a scrollable list of today's top 20 Nifty 50 gainers, and a compact key-details panel (name, price, 30-day avg volume, market cap, derived BUY/SELL/NEUTRAL signal).

## Goals

- Add a server-rendered `/stocks/[symbol]?exchange=NSE|BSE` page using the existing `(app)` shell.
- Wire each market-page search suggestion to navigate to that route.
- Render a large company name (≈26 px / 700) with the symbol code and an NSE/BSE `<Select>` next to it; changing the select replaces the URL with the other exchange.
- Render a 320-px-tall recharts area chart with 1M / 3M / 6M / 1Y range tabs and a "Full Chart →" button absolutely positioned in the chart's top-right corner.
- Render a 280-px right rail with: a debounced search input + suggestions dropdown, a scrollable list of the top 20 Nifty 50 gainers, and a key-details panel.
- Compute the signal server-side from 30-day daily closes using a 20-day SMA + 5-day momentum heuristic.
- Mobile: hide the rail; surface a header `Menu` button that opens the rail as a right-slide Radix `Dialog` drawer.

## Non-goals

- The "Full Chart" deep view — the button is a stub that fires a "coming soon" `toast` (no new route, no logic, no roadmap entry).
- No intraday tick-by-tick or candlestick chart on this page; daily closes only.
- No real-time push or polling — we rely on the existing 30-second quote cache; a hard reload re-fetches.
- No persisted user state (timeframe, exchange selection) across navigations or sessions.
- No watchlist add/remove affordance on this page.
- No indices, ETFs, SME, or losers in the top-20 list — gainers only, Nifty 50 only.
- No RSI / MACD / Bollinger / other indicators beyond the BUY/SELL/NEUTRAL chip.
- No symbol comparison view.
- No new UI primitive library; reuse Radix/shadcn components already in `src/components/ui`.
- No mobile-specific chart re-layout beyond width responsiveness; the rail is the only mobile-specific concession.
- No SEO metadata work for the route beyond the default Next.js `<title>` (the page is auth-gated).

## Files changed

**New**

- `src/app/(app)/stocks/[symbol]/page.tsx` — async Server Component; top-level page.
- `src/app/(app)/stocks/[symbol]/loading.tsx` — page-level skeleton.
- `src/app/api/historical/[symbol]/route.ts` — JSON endpoint feeding the client chart's timeframe switches.
- `src/components/stocks/stock-header.tsx` — name + symbol/exchange row + price (server).
- `src/components/stocks/exchange-select.tsx` — NSE/BSE `<Select>` (client).
- `src/components/stocks/timeframe-chart.tsx` — range tabs + recharts area chart + Full Chart button (client).
- `src/components/stocks/full-chart-stub.tsx` — small client wrapper that wires the Full Chart button to a `toast.info("Full Chart — coming soon")`.
- `src/components/stocks/top-gainers-list.tsx` — scrollable list (server).
- `src/components/stocks/sidebar-search.tsx` — debounced symbol search with suggestions (client).
- `src/components/stocks/key-details-panel.tsx` — label/value grid (server).
- `src/components/stocks/signal-badge.tsx` — colored chip (pure).
- `src/components/stocks/sidebar-toggle.tsx` — mobile-only Menu button + Radix Dialog drawer (client).
- `src/lib/market/historical.ts` — `getHistorical(symbol, exchange, range)` with cache.
- `src/lib/market/top-gainers.ts` — `getTopGainers()` with cache.
- `src/lib/market/meta.ts` — `getMetaInfo(symbol, exchange)` with cache.
- `src/lib/market/signal.ts` — pure `computeSignal(closes: number[])`.
- `supabase/migrations/0003_market_caches.sql` — `historical_cache` table (see Data model).

**Modified**

- `src/components/markets/symbol-search.tsx` — wrap each suggestion `<li>` content in `<Link href="/stocks/SYM?exchange=NSE">`.
- `src/lib/market/types.ts` — add `HistoricalCandle`, `MetaInfo`, `TopMover`, `Range`, `Signal` types.
- `src/types/database.ts` — regenerated via `npm run db:types` to pick up `historical_cache`.

## Data model

```sql
-- 0003_market_caches.sql
CREATE TABLE IF NOT EXISTS historical_cache (
  symbol     text   NOT NULL,
  exchange   text   NOT NULL CHECK (exchange IN ('NSE','BSE')),
  range      text   NOT NULL CHECK (range IN ('1M','3M','6M','1Y')),
  payload    jsonb  NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, exchange, range)
);

-- Service role only; no RLS — cache is shared across users.
ALTER TABLE historical_cache ENABLE ROW LEVEL SECURITY;
-- intentionally no policy → only service-role inserts/reads
```

In-memory caches (per Node process, identical pattern to `src/lib/market/cache.ts`):

| Cache | Memory TTL | DB TTL | Max entries |
|---|---|---|---|
| `historical_cache` | 5 min | 1 hr | 200 |
| `top_gainers` (in-memory only — single key) | 60 s | — | 1 |
| `meta_info` (in-memory only) | 1 hr | — | 500 |

Meta info isn't worth DB caching — it's small and the upstream call is fast enough; if the process restarts we'll just re-fetch. Top gainers churns and isn't worth DB caching either.

## Library modules

### `src/lib/market/types.ts` (additions)

```ts
export type Range = "1M" | "3M" | "6M" | "1Y";

export interface HistoricalCandle {
  date: string;   // ISO date, e.g. "2026-02-15"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TopMover {
  symbol: string;
  name: string | null;
  lastPrice: number;
  changePct: number;
}

export interface MetaInfo {
  symbol: string;
  exchange: Exchange;
  name: string | null;
  industry: string | null;
  marketCap: number | null;  // in INR, null when upstream omits it
}

export type Signal = "BUY" | "SELL" | "NEUTRAL";
```

### `src/lib/market/historical.ts`

```ts
export async function getHistorical(
  symbol: string,
  exchange: Exchange,
  range: Range,
): Promise<HistoricalCandle[]>;
```

Behavior:
- Range → `from_date` lookback: `1M`=30 d, `3M`=90 d, `6M`=180 d, `1Y`=365 d.
- Looks up `(symbol, exchange, range)` in memory first, then `historical_cache`, then calls `nse.fetchEquityHistoricalData({ symbol, from_date, to_date })` (only NSE supported for now; BSE returns `[]` and the chart shows "Chart unavailable for BSE.").
- Coalesces concurrent requests via an `inflight` map identical to `cache.ts`.
- Normalizes the loose upstream rows into `HistoricalCandle`. Skips rows missing close.
- Sorts ascending by date before returning.

### `src/lib/market/top-gainers.ts`

```ts
export async function getTopGainers(): Promise<TopMover[]>;
```

Behavior:
- Calls `nse.listEquityStocksByIndex("NIFTY 50")`.
- Sorts the returned `data` array by `pChange` descending.
- Slices the first 20, normalizes to `TopMover`.
- 60-second in-memory cache.
- Returns `[]` on upstream failure (caller renders an empty state).

### `src/lib/market/meta.ts`

```ts
export async function getMetaInfo(
  symbol: string,
  exchange: Exchange,
): Promise<MetaInfo>;
```

Behavior:
- NSE: `nse.getEquityMetaInfo(symbol)`. Pulls `name` from `info.companyName`, `industry` from `industryInfo.industry`, `marketCap` from `securityInfo.faceValue * issuedSize` if `marketCap` is not directly present — best-effort. Fields that can't be derived are `null`.
- BSE: no upstream meta endpoint — return `{ name: <from quote>, industry: null, marketCap: null }`.
- 1-hour in-memory cache keyed by `${exchange}:${symbol}`.

### `src/lib/market/signal.ts` (pure)

```ts
export function computeSignal(closes: number[]): Signal | null;
```

Behavior:
- Returns `null` when `closes.length < 20` (caller renders `—`).
- Computes `sma20 = mean(closes.slice(-20))`.
- Computes `mom5 = closes.at(-1) - closes.at(-6)` (returns `null` if length < 6).
- Returns `"BUY"` if `last > sma20 && mom5 > 0`, `"SELL"` if `last < sma20 && mom5 < 0`, else `"NEUTRAL"`.
- No side effects, fully unit-testable.

## API routes

### `GET /api/historical/[symbol]?exchange=NSE&range=3M`

- Validates `symbol` (1–40 chars) and `range` (`"1M"|"3M"|"6M"|"1Y"`) with Zod.
- Resolves exchange via the existing `parseExchange` helper (defaults to NSE).
- Calls `getHistorical(symbol, exchange, range)`.
- Returns `{ candles: HistoricalCandle[] }` with `Cache-Control: private, max-age=60`.
- On upstream error returns `{ error: <message> }` with `502`.
- `runtime = "nodejs"` (matches the other market routes).

No other new routes — `getTopGainers`, `getMetaInfo`, and `computeSignal` are consumed only from Server Components, so they're called directly without going over HTTP.

## Page composition

`src/app/(app)/stocks/[symbol]/page.tsx` (async Server Component):

```tsx
export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ exchange?: string }>;
}) {
  const { symbol } = await params;
  const exchange = parseExchange((await searchParams).exchange);
  const [quote, meta] = await Promise.all([
    getQuote(symbol, exchange),
    getMetaInfo(symbol, exchange),
  ]);

  return (
    <div className="space-y-4">
      <SidebarToggle /> {/* mobile-only Menu button */}
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-3">
          <StockHeader quote={quote} meta={meta} />
          <Suspense fallback={<ChartSkeleton />}>
            <StockChartPanel symbol={symbol} exchange={exchange} />
          </Suspense>
        </div>

        <aside className="hidden md:flex md:flex-col md:gap-3">
          <SidebarSearch />
          <Suspense fallback={<TopGainersSkeleton />}>
            <TopGainersList activeSymbol={symbol} />
          </Suspense>
          <Suspense fallback={<KeyDetailsSkeleton />}>
            <KeyDetailsPanel symbol={symbol} exchange={exchange} quote={quote} meta={meta} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
```

`StockChartPanel` is a thin server component that calls `getHistorical(symbol, exchange, "3M")` and passes the candles to the `TimeframeChart` client wrapper as `initial`.

`KeyDetailsPanel` is a server component that calls `getHistorical(symbol, exchange, "1M")` (we need 30 days for the signal anyway), derives `avgVolume30d = mean(last30.map(c => c.volume))`, runs `computeSignal(closes)`, and renders the grid.

`loading.tsx` renders the page skeleton: header lines, chart box, three sidebar boxes.

## Components

### `StockHeader` (server)

- Top: `<h1 class="text-2xl font-bold tracking-tight md:text-[26px]">` company name (from `meta.name ?? quote.name ?? quote.symbol`).
- Middle: `<div class="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">` symbol code + `·` + `<ExchangeSelect current={exchange} symbol={symbol} />`.
- Bottom: `<div class="mt-2 flex items-baseline gap-2">` price (`text-2xl font-semibold tabular-nums`) + day change (`signed(quote.change)` + `formatPercent(quote.changePct)` in `text-success`/`text-destructive`).
- This is the one place we deliberately deviate from `UI.md`'s "page H1 = `text-lg`" rule — the company name is the page's identity, and we approved the larger size during brainstorming.

### `ExchangeSelect` (client)

- Props: `current: Exchange`, `symbol: string`.
- Renders `<Select>` from `src/components/ui/select.tsx` with two options.
- On change: `router.replace("/stocks/" + symbol + "?exchange=" + next)`. Uses `replace` (not `push`) so the back button doesn't accumulate exchange-toggle history.

### `TimeframeChart` (client)

- Props: `initial: HistoricalCandle[]`, `symbol: string`, `exchange: Exchange`.
- State: `range: Range` (default `"3M"`), `candles: HistoricalCandle[]`, `loading: boolean`, `error: string | null`.
- Top toolbar (inside the chart frame, absolutely positioned top-right): `<button>Full Chart →</button>` wired via `FullChartStub` to `toast.info("Full Chart — coming soon")`.
- Range tabs above the chart: `1M / 3M / 6M / 1Y`. Active tab → `bg-accent`. Other tabs → `text-muted-foreground hover:bg-accent/50`. Built as plain buttons (no `Tabs` primitive needed — too heavy for 4 chips).
- On range change: set `range`, `setLoading(true)`, fetch `/api/historical/${symbol}?exchange=${exchange}&range=${range}`. Cancels prior request via `AbortController`. On success replaces `candles`; on failure sets `error`.
- Chart: recharts `AreaChart`, gradient fill from `hsl(var(--chart-1))`, daily close on the y-axis. Reuses the visual recipe in `src/components/charts/invested-chart.tsx`.
- Height: `h-80` (320 px). Empty state when `candles.length < 2`: "Not enough data to chart." Error state: "Chart unavailable. Try again later." (with a retry button that re-fires the fetch).
- Loading state during range switch: `<Skeleton class="h-80 w-full" />` replaces the chart body; tabs remain interactive.

### `FullChartStub` (client)

- Tiny wrapper that exposes a `<button>` with the right styling and an `onClick` that calls `toast.info("Full Chart — coming soon")` from `sonner`. The button is positioned absolutely by `TimeframeChart`; this component is only concerned with the click behaviour. Keeps `TimeframeChart` from importing `sonner` directly.

### `TopGainersList` (server)

- Calls `getTopGainers()`.
- `<section class="rounded-lg border bg-card">` with an uppercase label row "Top gainers · Nifty 50" and a `max-h-64 overflow-y-auto` body.
- Each row is `<Link href="/stocks/SYM?exchange=NSE">` with `flex items-center justify-between px-2.5 py-1 text-xs`. Symbol on the left, `+changePct%` (green) on the right, both `tabular-nums`.
- When `row.symbol === activeSymbol` and exchange is NSE → row gets `bg-accent/50 text-foreground`. Otherwise `text-muted-foreground hover:bg-accent`.
- Empty/failed state: a single row "Couldn't load top gainers." in muted text.

### `SidebarSearch` (client)

- Reuses the same mechanics as `src/components/watchlist/symbol-search-combobox.tsx` but does not enrich with quotes (the rail doesn't need prices on suggestions — that's noise).
- 250 ms debounce → `GET /api/search?q=…` → render up to 10 hits in a Radix `Popover` anchored below the input.
- Selecting a hit: `router.push("/stocks/" + hit.symbol + "?exchange=" + hit.exchange)`, clears the input.
- Compact input per UI.md: `h-8 text-xs`.

### `KeyDetailsPanel` (server)

- Receives `quote` and `meta` from the page; fetches `getHistorical(symbol, exchange, "1M")` itself (so it can stream independently of the chart panel).
- Computes `avgVolume30d` (skip on empty), `signal = computeSignal(closes)`.
- `<section class="rounded-lg border bg-card p-3">` with an uppercase "Key details" label and a 2-col grid.
- Rows (label / value):
  - Name → `meta.name ?? quote.name ?? "—"` (truncated to one line, `title=` for full).
  - Price → `formatINR(quote.lastPrice)` (`tabular-nums`).
  - Avg vol (30d) → `formatNumber(avg)` compact (`8.4M`), `—` when unavailable.
  - Mkt cap → `formatINR(marketCap, { compact: true })` (`₹16.7L Cr`), `—` when null (always `—` on BSE).
  - Signal → `<SignalBadge value={signal} />`.

### `SignalBadge` (pure)

- Maps `"BUY" → bg-success/15 text-success`, `"SELL" → bg-destructive/15 text-destructive`, `"NEUTRAL" → bg-muted text-muted-foreground`, `null → "—"` (no chip, just em-dash).
- Compact: `rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider`.

### `SidebarToggle` (client)

- Renders only `< md` via `md:hidden`.
- Button is a `<Button variant="ghost" size="icon">` with a `Menu` icon, placed at the top of `page.tsx`'s flow.
- Clicking opens a Radix `Dialog` with `DialogContent` styled as a right-slide drawer (`w-[280px]`, `right-0 top-0 h-full`). The dialog's body re-renders the three rail components.
- Pre-renders the rail tree even when closed so the server-streamed contents are ready when the dialog opens.

## Market-page wiring

`src/components/markets/symbol-search.tsx` — wrap each suggestion's content in a `<Link>`:

```tsx
<Link
  href={`/stocks/${encodeURIComponent(h.symbol)}?exchange=${h.exchange}`}
  className="flex items-center justify-between px-3 py-2 hover:bg-accent"
>
  {/* existing symbol + badge + name markup */}
</Link>
```

Replace the existing `<li class="flex items-center justify-between px-3 py-2">` wrapper with the `<Link>` directly (don't nest `<a>` inside `<li>` here — keep the markup flat).

No other markets-page changes (the indices panel stays as-is and is not clickable).

## Data flow

**Initial visit `/stocks/RELIANCE?exchange=NSE`:**
1. Server: `page.tsx` parallel-fetches `getQuote` and `getMetaInfo`. Both hit memory cache after first request.
2. Server streams `<StockHeader>` immediately; chart, top-gainers, and key-details panels stream as their suspense boundaries resolve.
3. Client hydrates `ExchangeSelect`, `SidebarSearch`, `TimeframeChart`, `FullChartStub`, `SidebarToggle`.

**Changing the timeframe to 1Y:**
1. `TimeframeChart` calls `fetch("/api/historical/RELIANCE?exchange=NSE&range=1Y")`.
2. API route hits `getHistorical("RELIANCE", "NSE", "1Y")` → memory miss → DB miss → upstream call → DB write → memory set → returns candles.
3. Chart swaps in the new data; existing candles stay in state until the new ones arrive (no flash).

**Switching exchange (NSE → BSE):**
1. `ExchangeSelect` calls `router.replace("/stocks/RELIANCE?exchange=BSE")`.
2. Page re-renders server-side with the BSE quote.
3. `KeyDetailsPanel` shows `marketCap = —` (no upstream); chart shows "Chart unavailable for BSE."

**Clicking a top-gainer row:**
1. `<Link>` navigates to `/stocks/SYM?exchange=NSE`.
2. Next.js soft-navigation re-renders the page; sidebar's `activeSymbol` highlight moves.

**Sidebar search → suggestion → click:**
1. User types → 250 ms debounce → `/api/search?q=…`.
2. Suggestions render in popover.
3. Click → `router.push("/stocks/SYM?exchange=NSE")` → soft navigation.

**Market-page suggestion click:**
1. User on `/markets`, types into `SymbolSearch`, picks `RELIANCE`.
2. `<Link>` navigates to `/stocks/RELIANCE?exchange=NSE`.

## Error handling

- `page.tsx` failures (quote / meta both fail) → throw → caught by `src/app/(app)/error.tsx`, which already renders a friendly reset surface.
- Quote fails but meta succeeds (or vice versa): we use `Promise.all`, so either failure throws. That's OK — without the quote the page is useless. (We don't try to render a "partial" stocks page.)
- Historical fetch in `StockChartPanel` or `KeyDetailsPanel` failing → the panel renders its own error state and the rest of the page stays mounted (each is wrapped in its own `<Suspense>` + `try/catch` inside the server component).
- `/api/historical` returns `502 { error }` on failure; the client chart shows "Chart unavailable. Try again later." with a retry button.
- `getTopGainers()` returning `[]` → list renders "Couldn't load top gainers." (single muted row).
- `getMetaInfo` returning all-null on BSE is expected, not an error — `—` everywhere is correct.
- Sidebar search: identical error semantics to the watchlist combobox — "Search unavailable, try again".
- Signal `null` (insufficient data) → render `—`, no badge.

## Testing

Existing stack: Vitest + React Testing Library; tests live under `tests/`.

- **Unit — `computeSignal`** — table-driven cases:
  - `length < 20` → `null`.
  - `last > sma20 && mom5 > 0` → `"BUY"`.
  - `last < sma20 && mom5 < 0` → `"SELL"`.
  - `last > sma20 && mom5 < 0` → `"NEUTRAL"`.
  - `last < sma20 && mom5 > 0` → `"NEUTRAL"`.
- **Unit — `getTopGainers`** — with the upstream client mocked, sorts by `pChange` desc and slices to 20; returns `[]` on upstream throw.
- **Unit — `historical.ts` range → from-date** — `"1M"` → 30 days back, `"1Y"` → 365 days back. Function under test is the small helper that maps `Range` to `from_date` (extract if needed).
- **Unit — `meta.ts` normalization** — given a stub `getEquityMetaInfo` payload, returns the expected `MetaInfo` shape with `marketCap = null` when missing.
- **Component — `TimeframeChart`** — clicking the `6M` tab fires `fetch` with the right URL (mock `global.fetch`); shows skeleton while pending; shows error state on 502.
- **Component — `ExchangeSelect`** — selecting `BSE` calls `router.replace("/stocks/RELIANCE?exchange=BSE")`.
- **Component — `SidebarSearch`** — debounces calls (fake timers), navigates on selection.
- **Component — `TopGainersList`** — given two mock rows, renders both as `<Link>` with the right `href`; highlights the active row.
- **Component — `SignalBadge`** — renders the right tint for each value; renders `—` for `null`.
- **Smoke — `page.tsx`** — given mocked `getQuote` + `getMetaInfo`, renders the header, the three suspense skeletons, and (after suspense resolves with mocked panels) the chart container, the gainers list, and the key-details grid.
- **Manual checklist** added to PR description:
  1. Type into the markets-page search → click a hit → land on `/stocks/SYM?exchange=NSE`.
  2. Toggle the exchange dropdown → URL changes, key-details re-render, chart shows BSE empty state.
  3. Click 1M / 3M / 6M / 1Y → chart re-fetches, no flicker between data swaps.
  4. Click "Full Chart →" → toast "Full Chart — coming soon".
  5. Click a top-gainer row → URL changes, the previously active row loses its highlight, the new one gets it.
  6. Resize to mobile (`< md`) → rail disappears, Menu button shows; tapping it opens the drawer with the same content.
  7. Visit `/stocks/INVALIDSYM` → page boundary renders the error surface (no white screen).

## Open questions

None at spec time. Implementation will surface details (exact Radix Select wiring, the precise upstream meta-info field for market cap, recharts margin/tick formatting) which are plan-level concerns.
