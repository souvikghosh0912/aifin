# Stocks detail page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/stocks/[symbol]?exchange=NSE|BSE` page with an embedded recharts area chart (1M/3M/6M/1Y), a right rail (search, top-20 Nifty 50 gainers, key details with a derived BUY/SELL/NEUTRAL signal), and a mobile drawer; wire the markets-page search suggestions to navigate to it.

**Architecture:** Next.js Server Components stream each panel under its own `<Suspense>`. New library modules (`historical.ts`, `top-gainers.ts`, `meta.ts`, `signal.ts`) wrap the `nse-bse-api` upstream with memory + Postgres caches. Client islands handle the timeframe switch, exchange dropdown, sidebar search, and mobile drawer.

**Tech Stack:** Next.js 15 (App Router), React 19, Radix UI primitives, Tailwind, recharts, Vitest + React Testing Library + jsdom, Supabase (Postgres + RLS), `nse-bse-api`.

---

## Spec reference

`docs/superpowers/specs/2026-05-22-stocks-detail-page-design.md`

## File structure

**New files**

| Path | Responsibility |
|---|---|
| `src/lib/market/signal.ts` | Pure `computeSignal(closes)` → `"BUY" \| "SELL" \| "NEUTRAL" \| null`. |
| `src/lib/market/historical.ts` | `getHistorical(symbol, exchange, range)` with memory + DB cache. Includes `rangeToDays(range)` helper. |
| `src/lib/market/top-gainers.ts` | `getTopGainers()` — Nifty 50 sorted by `pChange` desc, top 20, 60 s memory cache. |
| `src/lib/market/meta.ts` | `getMetaInfo(symbol, exchange)` — NSE meta info; BSE returns `{ name: null, industry: null, marketCap: null }`. 1 hr memory cache. |
| `supabase/migrations/0003_market_caches.sql` | `historical_cache` table. |
| `src/app/api/historical/[symbol]/route.ts` | `GET` endpoint feeding the client chart's range switcher. |
| `src/app/(app)/stocks/[symbol]/page.tsx` | Async Server Component, stitches the page. |
| `src/app/(app)/stocks/[symbol]/loading.tsx` | Page-level skeleton. |
| `src/components/stocks/signal-badge.tsx` | Pure colored chip. |
| `src/components/stocks/exchange-select.tsx` | Client `<Select>` for NSE/BSE; `router.replace`. |
| `src/components/stocks/full-chart-stub.tsx` | Client button that fires `toast.info("Full Chart — coming soon")`. |
| `src/components/stocks/timeframe-chart.tsx` | Client recharts `AreaChart` + 1M/3M/6M/1Y range tabs + floating Full Chart button. |
| `src/components/stocks/stock-header.tsx` | Server: company name, symbol + ExchangeSelect row, price + day-change. |
| `src/components/stocks/sidebar-search.tsx` | Client debounced search; selecting a hit navigates. |
| `src/components/stocks/top-gainers-list.tsx` | Server: list of `<Link>` rows. |
| `src/components/stocks/key-details-panel.tsx` | Server: label/value grid; fetches 1M historical for avg-vol + signal. |
| `src/components/stocks/sidebar-toggle.tsx` | Client mobile drawer (Radix Dialog) hosting the rail content. |

**Modified files**

| Path | Change |
|---|---|
| `src/lib/market/types.ts` | Add `Range`, `HistoricalCandle`, `TopMover`, `MetaInfo`, `Signal`. |
| `src/types/database.ts` | Manually add `historical_cache` Row/Insert/Update entry (the project's type file is hand-typed, not generated). |
| `src/components/markets/symbol-search.tsx` | Wrap each suggestion in `<Link href="/stocks/SYM?exchange=NSE">`. |

## Implementation notes that override the spec

- The spec's `npm run db:types` step is dropped. `src/types/database.ts` is hand-typed (verified) — we manually add the `historical_cache` entry in Task 3.
- All upstream upstream calls go through `nseBucket.acquire()` from `src/lib/market/rate-limit.ts` to stay within the existing NSE rate limit.

---

## Task 1: Add shared types

**Files:**
- Modify: `src/lib/market/types.ts`

- [ ] **Step 1: Add types**

Append to `src/lib/market/types.ts` (after `IndexQuote`, before `MarketDataError`):

```ts
export type Range = "1M" | "3M" | "6M" | "1Y";

export interface HistoricalCandle {
  date: string; // ISO date "YYYY-MM-DD"
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
  marketCap: number | null; // INR, null when upstream omits it
}

export type Signal = "BUY" | "SELL" | "NEUTRAL";
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/market/types.ts
git commit -m "feat(market): add Range/HistoricalCandle/TopMover/MetaInfo/Signal types"
```

---

## Task 2: `computeSignal` pure function (TDD)

**Files:**
- Create: `src/lib/market/signal.ts`
- Test: `tests/lib/market/signal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/market/signal.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeSignal } from "@/lib/market/signal";

function series(values: number[]): number[] {
  return values;
}

describe("computeSignal", () => {
  it("returns null when fewer than 20 closes", () => {
    expect(computeSignal(series([1, 2, 3]))).toBeNull();
    expect(computeSignal(series(Array(19).fill(100)))).toBeNull();
  });

  it("returns BUY when last > SMA20 and 5-day momentum > 0", () => {
    // closes ramp up: SMA20 of 20 values from 80..99 = 89.5; last=99; mom5 = 99-94 = 5
    const closes = Array.from({ length: 20 }, (_, i) => 80 + i);
    expect(computeSignal(closes)).toBe("BUY");
  });

  it("returns SELL when last < SMA20 and 5-day momentum < 0", () => {
    // closes ramp down: 99..80; last=80; SMA20=89.5; mom5 = 80-85 = -5
    const closes = Array.from({ length: 20 }, (_, i) => 99 - i);
    expect(computeSignal(closes)).toBe("SELL");
  });

  it("returns NEUTRAL when last > SMA20 but momentum is negative", () => {
    // First 15 low, then spike up, then dip: SMA pulled up, but last lower than 5 days ago.
    const closes = [
      ...Array(15).fill(50),
      120, 121, 122, 123, 110, // last=110, mom5 = 110-122 = -12, sma20 over 20 = (15*50 + 120+121+122+123+110)/20 = (750+596)/20 = 67.3
    ];
    expect(computeSignal(closes)).toBe("NEUTRAL");
  });

  it("returns NEUTRAL when last < SMA20 but momentum is positive", () => {
    // First 15 high, then crash + small recovery: SMA dragged high, last still below SMA, mom5 positive
    const closes = [
      ...Array(15).fill(200),
      80, 70, 60, 70, 90, // last=90, mom5=90-80=10, sma20=(15*200+80+70+60+70+90)/20=(3000+370)/20=168.5
    ];
    expect(computeSignal(closes)).toBe("NEUTRAL");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/market/signal.test.ts`
Expected: FAIL — "Cannot find module '@/lib/market/signal'".

- [ ] **Step 3: Implement `computeSignal`**

Create `src/lib/market/signal.ts`:

```ts
import type { Signal } from "./types";

/**
 * Heuristic BUY/SELL/NEUTRAL signal from a closing-price series.
 *
 * Rule:
 *   sma20 = mean of last 20 closes
 *   mom5  = closes[-1] - closes[-6]
 *   BUY  if last > sma20 AND mom5 > 0
 *   SELL if last < sma20 AND mom5 < 0
 *   else NEUTRAL
 *
 * Returns null when fewer than 20 closes are available (caller should render `—`).
 */
export function computeSignal(closes: number[]): Signal | null {
  if (closes.length < 20) return null;

  const last = closes[closes.length - 1]!;
  const fiveAgo = closes[closes.length - 6]!;
  const window = closes.slice(-20);
  const sma20 = window.reduce((a, b) => a + b, 0) / window.length;
  const mom5 = last - fiveAgo;

  if (last > sma20 && mom5 > 0) return "BUY";
  if (last < sma20 && mom5 < 0) return "SELL";
  return "NEUTRAL";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/market/signal.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/market/signal.ts tests/lib/market/signal.test.ts
git commit -m "feat(market): computeSignal — 20-day SMA + 5-day momentum"
```

---

## Task 3: `historical_cache` migration + database type

**Files:**
- Create: `supabase/migrations/0003_market_caches.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_market_caches.sql`:

```sql
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
```

- [ ] **Step 2: Add the type to `database.ts`**

In `src/types/database.ts`, insert after the `quote_cache` entry (around line 124, before `ai_conversations`):

```ts
      historical_cache: {
        Row: {
          symbol: string;
          exchange: Exchange;
          range: "1M" | "3M" | "6M" | "1Y";
          payload: Json;
          fetched_at: string;
        };
        Insert: {
          symbol: string;
          exchange: Exchange;
          range: "1M" | "3M" | "6M" | "1Y";
          payload: Json;
          fetched_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["historical_cache"]["Insert"]
        >;
        Relationships: [];
      };
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_market_caches.sql src/types/database.ts
git commit -m "feat(db): historical_cache table for OHLC range cache"
```

---

## Task 4: `getHistorical` with cache (TDD)

**Files:**
- Create: `src/lib/market/historical.ts`
- Test: `tests/lib/market/historical.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/market/historical.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricalCandle } from "@/lib/market/types";

async function loadHistorical(opts?: {
  upstream?: (symbol: string, from: Date, to: Date) => Promise<unknown[]>;
  dbRow?: { payload: HistoricalCandle[]; fetched_at: string } | null;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));

  const upstream =
    opts?.upstream ??
    (async () => [
      { CH_TIMESTAMP: "2026-04-01", CH_OPENING_PRICE: 100, CH_TRADE_HIGH_PRICE: 105, CH_TRADE_LOW_PRICE: 99, CH_CLOSING_PRICE: 104, CH_TOT_TRADED_QTY: 1000 },
    ]);

  vi.doMock("nse-bse-api", () => ({
    NSE: class {
      async fetchEquityHistoricalData(p: { symbol: string; from_date: Date; to_date: Date }) {
        return upstream(p.symbol, p.from_date, p.to_date);
      }
    },
    BSE: class {},
  }));

  const dbRow = opts?.dbRow ?? null;
  vi.doMock("@/lib/supabase/server", () => ({
    createServiceClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: dbRow, error: null }) }),
            }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
    }),
  }));

  return await import("@/lib/market/historical");
}

describe("rangeToDays", () => {
  it("maps each Range to the right day window", async () => {
    const { rangeToDays } = await loadHistorical();
    expect(rangeToDays("1M")).toBe(30);
    expect(rangeToDays("3M")).toBe(90);
    expect(rangeToDays("6M")).toBe(180);
    expect(rangeToDays("1Y")).toBe(365);
  });
});

describe("getHistorical", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns BSE as empty (no upstream available)", async () => {
    const upstream = vi.fn(async () => [{ CH_TIMESTAMP: "2026-04-01", CH_CLOSING_PRICE: 100 }]);
    const { getHistorical } = await loadHistorical({ upstream });
    const out = await getHistorical("RELIANCE", "BSE", "3M");
    expect(out).toEqual([]);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("calls upstream once and sorts ascending by date", async () => {
    const upstream = vi.fn(async () => [
      { CH_TIMESTAMP: "2026-04-03", CH_OPENING_PRICE: 102, CH_TRADE_HIGH_PRICE: 106, CH_TRADE_LOW_PRICE: 100, CH_CLOSING_PRICE: 105, CH_TOT_TRADED_QTY: 1100 },
      { CH_TIMESTAMP: "2026-04-01", CH_OPENING_PRICE: 100, CH_TRADE_HIGH_PRICE: 105, CH_TRADE_LOW_PRICE: 99, CH_CLOSING_PRICE: 104, CH_TOT_TRADED_QTY: 1000 },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    const out = await getHistorical("RELIANCE", "NSE", "1M");
    expect(out.map((c) => c.date)).toEqual(["2026-04-01", "2026-04-03"]);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("serves a warm memory hit without calling upstream", async () => {
    const upstream = vi.fn(async () => [
      { CH_TIMESTAMP: "2026-04-01", CH_CLOSING_PRICE: 100, CH_OPENING_PRICE: 100, CH_TRADE_HIGH_PRICE: 100, CH_TRADE_LOW_PRICE: 100, CH_TOT_TRADED_QTY: 0 },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    await getHistorical("TCS", "NSE", "3M");
    await getHistorical("TCS", "NSE", "3M");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("differentiates by range key", async () => {
    const upstream = vi.fn(async () => [
      { CH_TIMESTAMP: "2026-04-01", CH_CLOSING_PRICE: 100, CH_OPENING_PRICE: 100, CH_TRADE_HIGH_PRICE: 100, CH_TRADE_LOW_PRICE: 100, CH_TOT_TRADED_QTY: 0 },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    await getHistorical("INFY", "NSE", "1M");
    await getHistorical("INFY", "NSE", "3M");
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("skips rows missing a closing price", async () => {
    const upstream = vi.fn(async () => [
      { CH_TIMESTAMP: "2026-04-01", CH_CLOSING_PRICE: 100, CH_OPENING_PRICE: 100, CH_TRADE_HIGH_PRICE: 100, CH_TRADE_LOW_PRICE: 100, CH_TOT_TRADED_QTY: 0 },
      { CH_TIMESTAMP: "2026-04-02", CH_CLOSING_PRICE: null },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    const out = await getHistorical("WIPRO", "NSE", "1M");
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/market/historical.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `historical.ts`**

Create `src/lib/market/historical.ts`:

```ts
import "server-only";
import path from "node:path";
import os from "node:os";

import { createServiceClient } from "@/lib/supabase/server";
import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import {
  MarketDataError,
  type HistoricalCandle,
  type Range,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MEM_TTL_MS = 5 * 60_000; // 5 min
const DB_TTL_MS = 60 * 60_000; // 1 hr
const MAX_MEM_ENTRIES = 200;

interface CacheEntry {
  value: HistoricalCandle[];
  expiresAt: number;
}

const mem = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<HistoricalCandle[]>>();

function key(symbol: string, exchange: Exchange, range: Range) {
  return `${exchange}:${normalizeSymbol(symbol)}:${range}`;
}

export function rangeToDays(range: Range): number {
  switch (range) {
    case "1M":
      return 30;
    case "3M":
      return 90;
    case "6M":
      return 180;
    case "1Y":
      return 365;
  }
}

let _nse: any = null;
async function getNse(): Promise<any> {
  if (_nse) return _nse;
  const mod: any = await import("nse-bse-api");
  const NSE = mod.NSE ?? mod.default?.NSE;
  if (!NSE) throw new MarketDataError("nse-bse-api: NSE export not found");
  _nse = new NSE(
    path.join(os.tmpdir(), "ai-finance-dashboard", "nse-bse-api", "nse"),
    { timeout: 10_000 },
  );
  return _nse;
}

function memGet(k: string): HistoricalCandle[] | null {
  const e = mem.get(k);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    mem.delete(k);
    return null;
  }
  mem.delete(k);
  mem.set(k, e);
  return e.value;
}

function memSet(k: string, value: HistoricalCandle[]) {
  if (mem.size >= MAX_MEM_ENTRIES) {
    const first = mem.keys().next().value;
    if (first) mem.delete(first);
  }
  mem.set(k, { value, expiresAt: Date.now() + MEM_TTL_MS });
}

async function dbGet(
  symbol: string,
  exchange: Exchange,
  range: Range,
): Promise<HistoricalCandle[] | null> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("historical_cache")
      .select("payload, fetched_at")
      .eq("symbol", symbol)
      .eq("exchange", exchange)
      .eq("range", range)
      .maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > DB_TTL_MS) return null;
    return data.payload as unknown as HistoricalCandle[];
  } catch {
    return null;
  }
}

async function dbSet(
  symbol: string,
  exchange: Exchange,
  range: Range,
  value: HistoricalCandle[],
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("historical_cache").upsert({
      symbol,
      exchange,
      range,
      payload: value as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    });
  } catch {
    /* best-effort */
  }
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dateStr(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeRow(raw: any): HistoricalCandle | null {
  const date =
    dateStr(raw.CH_TIMESTAMP ?? raw.mTIMESTAMP ?? raw.date ?? raw.timestamp);
  const close = num(raw.CH_CLOSING_PRICE ?? raw.close);
  if (!date || close == null) return null;
  return {
    date,
    open: num(raw.CH_OPENING_PRICE ?? raw.open) ?? close,
    high: num(raw.CH_TRADE_HIGH_PRICE ?? raw.high) ?? close,
    low: num(raw.CH_TRADE_LOW_PRICE ?? raw.low) ?? close,
    close,
    volume: num(raw.CH_TOT_TRADED_QTY ?? raw.volume) ?? 0,
  };
}

export async function getHistorical(
  symbol: string,
  exchange: Exchange,
  range: Range,
): Promise<HistoricalCandle[]> {
  if (exchange === "BSE") return []; // upstream not available for BSE

  const sym = normalizeSymbol(symbol);
  const k = key(sym, exchange, range);

  const hit = memGet(k);
  if (hit) return hit;

  const existing = inflight.get(k);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const fromDb = await dbGet(sym, exchange, range);
      if (fromDb) {
        memSet(k, fromDb);
        return fromDb;
      }
      await nseBucket.acquire();
      const nse = await getNse();
      const days = rangeToDays(range);
      const to = new Date();
      const from = new Date(Date.now() - days * 86_400_000);
      const raw = await nse.fetchEquityHistoricalData({
        symbol: sym,
        from_date: from,
        to_date: to,
      });
      const list: any[] = Array.isArray(raw) ? raw : [];
      const normalized = list
        .map(normalizeRow)
        .filter((c): c is HistoricalCandle => c !== null)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      memSet(k, normalized);
      void dbSet(sym, exchange, range, normalized);
      return normalized;
    } finally {
      inflight.delete(k);
    }
  })();

  inflight.set(k, promise);
  return promise;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/market/historical.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/market/historical.ts tests/lib/market/historical.test.ts
git commit -m "feat(market): getHistorical with memory + DB cache"
```

---

## Task 5: `getTopGainers` (TDD)

**Files:**
- Create: `src/lib/market/top-gainers.ts`
- Test: `tests/lib/market/top-gainers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/market/top-gainers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadTopGainers(opts?: {
  upstream?: () => Promise<unknown> | unknown;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));
  vi.doMock("nse-bse-api", () => ({
    NSE: class {
      async listEquityStocksByIndex(_idx: string) {
        return opts?.upstream ? opts.upstream() : { data: [] };
      }
    },
    BSE: class {},
  }));
  return await import("@/lib/market/top-gainers");
}

describe("getTopGainers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the top 20 by pChange desc, normalizing fields", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      symbol: `SYM${i}`,
      meta: { companyName: `Co ${i}` },
      lastPrice: 100 + i,
      pChange: i, // 0..29
    }));
    const { getTopGainers } = await loadTopGainers({
      upstream: async () => ({ data: rows }),
    });
    const out = await getTopGainers();
    expect(out).toHaveLength(20);
    expect(out[0].symbol).toBe("SYM29");
    expect(out[0].changePct).toBe(29);
    expect(out[0].name).toBe("Co 29");
  });

  it("returns [] on upstream throw", async () => {
    const { getTopGainers } = await loadTopGainers({
      upstream: () => {
        throw new Error("boom");
      },
    });
    expect(await getTopGainers()).toEqual([]);
  });

  it("returns [] when upstream returns a non-array payload", async () => {
    const { getTopGainers } = await loadTopGainers({
      upstream: async () => ({ data: null }),
    });
    expect(await getTopGainers()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/market/top-gainers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `top-gainers.ts`**

Create `src/lib/market/top-gainers.ts`:

```ts
import "server-only";
import path from "node:path";
import os from "node:os";

import { nseBucket } from "./rate-limit";
import { MarketDataError, type TopMover } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TTL_MS = 60_000;
let cache: { value: TopMover[]; expiresAt: number } | null = null;

let _nse: any = null;
async function getNse(): Promise<any> {
  if (_nse) return _nse;
  const mod: any = await import("nse-bse-api");
  const NSE = mod.NSE ?? mod.default?.NSE;
  if (!NSE) throw new MarketDataError("nse-bse-api: NSE export not found");
  _nse = new NSE(
    path.join(os.tmpdir(), "ai-finance-dashboard", "nse-bse-api", "nse"),
    { timeout: 10_000 },
  );
  return _nse;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getTopGainers(): Promise<TopMover[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    await nseBucket.acquire();
    const nse = await getNse();
    const raw: any = await nse.listEquityStocksByIndex("NIFTY 50");
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

    const movers: TopMover[] = list
      .map((r) => ({
        symbol: String(r.symbol ?? r.SYMBOL ?? "").toUpperCase(),
        name:
          r.meta?.companyName ??
          r.companyName ??
          r.name ??
          null,
        lastPrice: num(r.lastPrice ?? r.last ?? r.ltp),
        changePct: num(r.pChange ?? r.percentChange),
      }))
      .filter((m) => m.symbol.length > 0)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 20);

    cache = { value: movers, expiresAt: Date.now() + TTL_MS };
    return movers;
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/market/top-gainers.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/market/top-gainers.ts tests/lib/market/top-gainers.test.ts
git commit -m "feat(market): getTopGainers — Nifty 50 sorted by pChange"
```

---

## Task 6: `getMetaInfo` (TDD)

**Files:**
- Create: `src/lib/market/meta.ts`
- Test: `tests/lib/market/meta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/market/meta.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadMeta(opts?: {
  upstream?: () => Promise<unknown> | unknown;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));
  vi.doMock("nse-bse-api", () => ({
    NSE: class {
      async getEquityMetaInfo(_s: string) {
        return opts?.upstream ? opts.upstream() : null;
      }
    },
    BSE: class {},
  }));
  return await import("@/lib/market/meta");
}

describe("getMetaInfo", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("normalizes the NSE payload", async () => {
    const { getMetaInfo } = await loadMeta({
      upstream: async () => ({
        info: { companyName: "Reliance Industries" },
        industryInfo: { industry: "Refineries" },
        securityInfo: { issuedSize: 6_000_000_000, faceValue: 10 },
        priceInfo: { lastPrice: 2400 },
      }),
    });
    const out = await getMetaInfo("RELIANCE", "NSE");
    expect(out.name).toBe("Reliance Industries");
    expect(out.industry).toBe("Refineries");
    expect(out.marketCap).toBeGreaterThan(0);
  });

  it("returns null fields when upstream omits them", async () => {
    const { getMetaInfo } = await loadMeta({ upstream: async () => ({}) });
    const out = await getMetaInfo("XYZ", "NSE");
    expect(out).toEqual({
      symbol: "XYZ",
      exchange: "NSE",
      name: null,
      industry: null,
      marketCap: null,
    });
  });

  it("returns an all-null shape for BSE without calling upstream", async () => {
    const upstream = vi.fn(async () => ({ info: { companyName: "foo" } }));
    const { getMetaInfo } = await loadMeta({ upstream });
    const out = await getMetaInfo("RELIANCE", "BSE");
    expect(out).toEqual({
      symbol: "RELIANCE",
      exchange: "BSE",
      name: null,
      industry: null,
      marketCap: null,
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns null fields when upstream throws", async () => {
    const { getMetaInfo } = await loadMeta({
      upstream: () => {
        throw new Error("boom");
      },
    });
    const out = await getMetaInfo("RELIANCE", "NSE");
    expect(out.name).toBeNull();
    expect(out.marketCap).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/market/meta.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `meta.ts`**

Create `src/lib/market/meta.ts`:

```ts
import "server-only";
import path from "node:path";
import os from "node:os";

import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import { MarketDataError, type MetaInfo } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TTL_MS = 60 * 60_000; // 1 hour
const mem = new Map<string, { value: MetaInfo; expiresAt: number }>();

let _nse: any = null;
async function getNse(): Promise<any> {
  if (_nse) return _nse;
  const mod: any = await import("nse-bse-api");
  const NSE = mod.NSE ?? mod.default?.NSE;
  if (!NSE) throw new MarketDataError("nse-bse-api: NSE export not found");
  _nse = new NSE(
    path.join(os.tmpdir(), "ai-finance-dashboard", "nse-bse-api", "nse"),
    { timeout: 10_000 },
  );
  return _nse;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emptyMeta(symbol: string, exchange: Exchange): MetaInfo {
  return {
    symbol: normalizeSymbol(symbol),
    exchange,
    name: null,
    industry: null,
    marketCap: null,
  };
}

export async function getMetaInfo(
  symbol: string,
  exchange: Exchange,
): Promise<MetaInfo> {
  const sym = normalizeSymbol(symbol);
  if (exchange === "BSE") return emptyMeta(sym, exchange);

  const key = `${exchange}:${sym}`;
  const hit = mem.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    await nseBucket.acquire();
    const nse = await getNse();
    const raw: any = await nse.getEquityMetaInfo(sym);
    if (!raw || typeof raw !== "object") {
      const v = emptyMeta(sym, exchange);
      mem.set(key, { value: v, expiresAt: Date.now() + TTL_MS });
      return v;
    }
    const issued = num(raw.securityInfo?.issuedSize);
    const face = num(raw.securityInfo?.faceValue);
    const last = num(raw.priceInfo?.lastPrice ?? raw.priceInfo?.ltp);
    const marketCap =
      num(raw.marketCap) ??
      (issued != null && last != null
        ? issued * last
        : issued != null && face != null
          ? issued * face
          : null);

    const value: MetaInfo = {
      symbol: sym,
      exchange,
      name: raw.info?.companyName ?? raw.companyName ?? null,
      industry: raw.industryInfo?.industry ?? raw.industry ?? null,
      marketCap,
    };
    mem.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch {
    return emptyMeta(sym, exchange);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/market/meta.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/market/meta.ts tests/lib/market/meta.test.ts
git commit -m "feat(market): getMetaInfo — NSE only, normalized shape"
```

---

## Task 7: `/api/historical/[symbol]` route (TDD)

**Files:**
- Create: `src/app/api/historical/[symbol]/route.ts`
- Test: `tests/api/historical.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/historical.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarketDataError } from "@/lib/market/types";

const getHistorical = vi.fn();

vi.mock("@/lib/market/historical", () => ({
  getHistorical: (s: string, e: "NSE" | "BSE", r: "1M" | "3M" | "6M" | "1Y") =>
    getHistorical(s, e, r),
}));

async function getRoute() {
  return (await import("@/app/api/historical/[symbol]/route")).GET;
}

describe("GET /api/historical/[symbol]", () => {
  beforeEach(() => {
    getHistorical.mockReset();
  });

  it("returns candles for a valid request, defaulting to NSE + 3M", async () => {
    getHistorical.mockResolvedValue([
      { date: "2026-04-01", open: 100, high: 101, low: 99, close: 100, volume: 1 },
    ]);
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    const body = await res.json();
    expect(body.candles).toHaveLength(1);
    expect(getHistorical).toHaveBeenCalledWith("RELIANCE", "NSE", "3M");
  });

  it("honors range and exchange query params", async () => {
    getHistorical.mockResolvedValue([]);
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(
        new URL("http://localhost/api/historical/TCS?range=1Y&exchange=BSE"),
      ),
      { params: Promise.resolve({ symbol: "TCS" }) },
    );
    expect(res.status).toBe(200);
    expect(getHistorical).toHaveBeenCalledWith("TCS", "BSE", "1Y");
  });

  it("returns 400 for an unknown range", async () => {
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/TCS?range=2Y")),
      { params: Promise.resolve({ symbol: "TCS" }) },
    );
    expect(res.status).toBe(400);
    expect(getHistorical).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty symbol", async () => {
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/_")),
      { params: Promise.resolve({ symbol: "" }) },
    );
    expect(res.status).toBe(400);
  });

  it("surfaces MarketDataError as 502", async () => {
    getHistorical.mockRejectedValue(new MarketDataError("upstream_down"));
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_down" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api/historical.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

Create `src/app/api/historical/[symbol]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getHistorical } from "@/lib/market/historical";
import { parseExchange } from "@/lib/market/symbols";
import { MarketDataError } from "@/lib/market/types";

export const runtime = "nodejs";

const ParamsSchema = z.object({ symbol: z.string().min(1).max(40) });
const RangeSchema = z.enum(["1M", "3M", "6M", "1Y"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  const params = await context.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const exchange = parseExchange(request.nextUrl.searchParams.get("exchange"));
  const rangeRaw = request.nextUrl.searchParams.get("range") ?? "3M";
  const rangeParsed = RangeSchema.safeParse(rangeRaw);
  if (!rangeParsed.success) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  try {
    const candles = await getHistorical(parsed.data.symbol, exchange, rangeParsed.data);
    return NextResponse.json(
      { candles },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    const message =
      err instanceof MarketDataError ? err.message : "fetch_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/api/historical.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/historical/[symbol]/route.ts tests/api/historical.test.ts
git commit -m "feat(api): GET /api/historical/[symbol] with range + exchange"
```

---

## Task 8: `SignalBadge` (pure component)

**Files:**
- Create: `src/components/stocks/signal-badge.tsx`
- Test: `tests/components/stocks/signal-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/signal-badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalBadge } from "@/components/stocks/signal-badge";

describe("<SignalBadge />", () => {
  it("renders BUY with success tint", () => {
    render(<SignalBadge value="BUY" />);
    const el = screen.getByText("BUY");
    expect(el).toHaveClass("text-success");
  });

  it("renders SELL with destructive tint", () => {
    render(<SignalBadge value="SELL" />);
    expect(screen.getByText("SELL")).toHaveClass("text-destructive");
  });

  it("renders NEUTRAL with muted tint", () => {
    render(<SignalBadge value="NEUTRAL" />);
    expect(screen.getByText("NEUTRAL")).toHaveClass("text-muted-foreground");
  });

  it("renders em-dash for null", () => {
    render(<SignalBadge value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/signal-badge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SignalBadge`**

Create `src/components/stocks/signal-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/market/types";

interface Props {
  value: Signal | null;
}

const TINT: Record<Signal, string> = {
  BUY: "bg-success/15 text-success",
  SELL: "bg-destructive/15 text-destructive",
  NEUTRAL: "bg-muted text-muted-foreground",
};

export function SignalBadge({ value }: Props) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TINT[value],
      )}
    >
      {value}
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/signal-badge.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/signal-badge.tsx tests/components/stocks/signal-badge.test.tsx
git commit -m "feat(stocks): SignalBadge component"
```

---

## Task 9: `ExchangeSelect` (TDD, client)

**Files:**
- Create: `src/components/stocks/exchange-select.tsx`
- Test: `tests/components/stocks/exchange-select.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/exchange-select.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

import { ExchangeSelect } from "@/components/stocks/exchange-select";

describe("<ExchangeSelect />", () => {
  it("shows the current exchange and replaces the URL on change", async () => {
    replace.mockReset();
    const user = userEvent.setup();
    render(<ExchangeSelect symbol="RELIANCE" current="NSE" />);

    expect(screen.getByText("NSE")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "BSE" }));

    expect(replace).toHaveBeenCalledWith("/stocks/RELIANCE?exchange=BSE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/exchange-select.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ExchangeSelect`**

Create `src/components/stocks/exchange-select.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Exchange } from "@/types/database";

interface Props {
  symbol: string;
  current: Exchange;
}

export function ExchangeSelect({ symbol, current }: Props) {
  const router = useRouter();
  return (
    <Select
      value={current}
      onValueChange={(next) => {
        router.replace(`/stocks/${encodeURIComponent(symbol)}?exchange=${next}`);
      }}
    >
      <SelectTrigger className="h-6 w-[72px] gap-1 rounded border border-border px-2 py-0 text-xs font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NSE">NSE</SelectItem>
        <SelectItem value="BSE">BSE</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/exchange-select.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/exchange-select.tsx tests/components/stocks/exchange-select.test.tsx
git commit -m "feat(stocks): ExchangeSelect — NSE/BSE dropdown"
```

---

## Task 10: `FullChartStub` (client)

**Files:**
- Create: `src/components/stocks/full-chart-stub.tsx`

- [ ] **Step 1: Implement**

Create `src/components/stocks/full-chart-stub.tsx`:

```tsx
"use client";

import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function FullChartStub({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => toast.info("Full Chart — coming soon")}
      className={cn(
        "rounded border bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      Full Chart →
    </button>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/stocks/full-chart-stub.tsx
git commit -m "feat(stocks): FullChartStub — coming-soon toast button"
```

---

## Task 11: `TimeframeChart` (TDD, client)

**Files:**
- Create: `src/components/stocks/timeframe-chart.tsx`
- Test: `tests/components/stocks/timeframe-chart.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/timeframe-chart.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimeframeChart } from "@/components/stocks/timeframe-chart";
import type { HistoricalCandle } from "@/lib/market/types";

function initial(): HistoricalCandle[] {
  return Array.from({ length: 5 }, (_, i) => ({
    date: `2026-04-0${i + 1}`,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1000,
  }));
}

describe("<TimeframeChart />", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {} unobserve() {} disconnect() {}
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the initial range as active", () => {
    render(<TimeframeChart initial={initial()} symbol="RELIANCE" exchange="NSE" />);
    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("fetches when switching to 1Y", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ candles: initial() }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<TimeframeChart initial={initial()} symbol="RELIANCE" exchange="NSE" />);

    await user.click(screen.getByRole("button", { name: "1Y" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/historical/RELIANCE?exchange=NSE&range=1Y",
        expect.anything(),
      );
    });
    expect(screen.getByRole("button", { name: "1Y" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("shows the error state when the fetch returns 502", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "upstream_down" }), { status: 502 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<TimeframeChart initial={initial()} symbol="RELIANCE" exchange="NSE" />);

    await user.click(screen.getByRole("button", { name: "6M" }));

    expect(
      await screen.findByText(/Chart unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders 'Not enough data' when initial has < 2 candles", () => {
    render(<TimeframeChart initial={[]} symbol="RELIANCE" exchange="NSE" />);
    expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/timeframe-chart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TimeframeChart`**

Create `src/components/stocks/timeframe-chart.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FullChartStub } from "@/components/stocks/full-chart-stub";
import { Skeleton } from "@/components/ui/skeleton";
import type { Exchange } from "@/types/database";
import type { HistoricalCandle, Range } from "@/lib/market/types";
import { cn, formatINR } from "@/lib/utils";

interface Props {
  initial: HistoricalCandle[];
  symbol: string;
  exchange: Exchange;
}

const RANGES: Range[] = ["1M", "3M", "6M", "1Y"];

export function TimeframeChart({ initial, symbol, exchange }: Props) {
  const [range, setRange] = useState<Range>("3M");
  const [candles, setCandles] = useState<HistoricalCandle[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function selectRange(next: Range) {
    if (next === range && !error) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRange(next);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/historical/${encodeURIComponent(symbol)}?exchange=${exchange}&range=${next}`,
        { signal: ac.signal },
      );
      if (!res.ok) {
        setError("Chart unavailable. Try again later.");
        return;
      }
      const body = (await res.json()) as { candles: HistoricalCandle[] };
      setCandles(body.candles ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Chart unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 text-xs">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            data-active={r === range}
            onClick={() => selectRange(r)}
            className={cn(
              "rounded px-2.5 py-1 font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
              r === range && "bg-accent text-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="relative h-80 rounded-lg border bg-card p-3">
        <FullChartStub className="absolute right-2 top-2 z-10" />
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : error ? (
          <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => selectRange(range)}
              className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
            >
              Retry
            </button>
          </div>
        ) : candles.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough data to chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={candles} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatINR(v, { compact: true })}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatINR(v)}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="hsl(var(--chart-1))"
                fillOpacity={1}
                fill="url(#stockGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/timeframe-chart.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/timeframe-chart.tsx tests/components/stocks/timeframe-chart.test.tsx
git commit -m "feat(stocks): TimeframeChart — 1M/3M/6M/1Y with floating Full Chart button"
```

---

## Task 12: `StockHeader` (server)

**Files:**
- Create: `src/components/stocks/stock-header.tsx`
- Test: `tests/components/stocks/stock-header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/stock-header.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

import { StockHeader } from "@/components/stocks/stock-header";
import type { Quote, MetaInfo } from "@/lib/market/types";

const quote: Quote = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries",
  lastPrice: 2478.3,
  previousClose: 2459.85,
  open: 2460,
  dayHigh: 2480,
  dayLow: 2458,
  change: 18.45,
  changePct: 0.75,
  volume: 1_000_000,
  asOf: "2026-05-22T10:00:00Z",
};

const meta: MetaInfo = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries Ltd",
  industry: "Refineries",
  marketCap: 16_700_000_000_000,
};

describe("<StockHeader />", () => {
  it("renders meta name, symbol, exchange, price, and signed change", () => {
    render(<StockHeader quote={quote} meta={meta} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Reliance Industries Ltd",
    );
    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("NSE")).toBeInTheDocument();
    expect(screen.getByText(/2,478\.30/)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.75%/)).toBeInTheDocument();
  });

  it("falls back to quote.name when meta.name is null", () => {
    render(
      <StockHeader
        quote={quote}
        meta={{ ...meta, name: null }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Reliance Industries",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/stock-header.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StockHeader`**

Create `src/components/stocks/stock-header.tsx`:

```tsx
import { ExchangeSelect } from "@/components/stocks/exchange-select";
import type { MetaInfo, Quote } from "@/lib/market/types";
import { cn, formatINR, formatPercent, signed } from "@/lib/utils";

interface Props {
  quote: Quote;
  meta: MetaInfo;
}

export function StockHeader({ quote, meta }: Props) {
  const name = meta.name ?? quote.name ?? quote.symbol;
  const up = quote.change >= 0;
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-[26px]">
        {name}
      </h1>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{quote.symbol}</span>
        <span className="opacity-50">·</span>
        <ExchangeSelect symbol={quote.symbol} current={quote.exchange} />
      </div>
      <div className="flex items-baseline gap-2 pt-1">
        <span className="num text-2xl font-semibold tabular-nums">
          {formatINR(quote.lastPrice)}
        </span>
        <span
          className={cn(
            "num text-xs tabular-nums",
            up ? "text-success" : "text-destructive",
          )}
        >
          {signed(quote.change)} ({formatPercent(quote.changePct)})
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/stock-header.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/stock-header.tsx tests/components/stocks/stock-header.test.tsx
git commit -m "feat(stocks): StockHeader — large company name + symbol/exchange + price"
```

---

## Task 13: `SidebarSearch` (TDD, client)

**Files:**
- Create: `src/components/stocks/sidebar-search.tsx`
- Test: `tests/components/stocks/sidebar-search.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/sidebar-search.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

import { SidebarSearch } from "@/components/stocks/sidebar-search";

describe("<SidebarSearch />", () => {
  beforeEach(() => {
    push.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            hits: [{ symbol: "TCS", exchange: "NSE", name: "Tata Consultancy" }],
          }),
          { status: 200 },
        ),
      ),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces typing then renders a suggestion and navigates on click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SidebarSearch />);
    const input = screen.getByPlaceholderText(/search stocks/i);
    await user.type(input, "tcs");

    await act(async () => {
      vi.advanceTimersByTime(260);
    });

    const row = await screen.findByRole("option", { name: /TCS/i });
    await user.click(row);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/stocks/TCS?exchange=NSE");
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/sidebar-search.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SidebarSearch`**

Create `src/components/stocks/sidebar-search.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { SymbolSearchHit } from "@/lib/market/types";
import { cn } from "@/lib/utils";

export function SidebarSearch() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    const myId = ++reqId.current;
    const ac = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!r.ok) throw new Error("search_failed");
        const { hits } = (await r.json()) as { hits: SymbolSearchHit[] };
        if (myId === reqId.current) setHits(hits.slice(0, 10));
      } catch {
        if (myId === reqId.current) {
          setError("Search unavailable, try again");
          setHits([]);
        }
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(handle);
      ac.abort();
    };
  }, [text]);

  function go(hit: SymbolSearchHit) {
    router.push(`/stocks/${encodeURIComponent(hit.symbol)}?exchange=${hit.exchange}`);
    setText("");
    setOpen(false);
  }

  const showPopover = open && text.trim().length > 0;

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search stocks…"
            className="h-8 pl-7 text-xs"
            autoComplete="off"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        role="listbox"
      >
        {error ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{error}</p>
        ) : loading && hits.length === 0 ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : hits.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches</p>
        ) : (
          hits.map((h) => (
            <button
              key={`${h.exchange}:${h.symbol}`}
              type="button"
              role="option"
              aria-selected={false}
              aria-label={`${h.symbol} ${h.exchange}`}
              onClick={() => go(h)}
              className={cn(
                "flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-xs hover:bg-accent",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-medium">{h.symbol}</span>
                <span className="text-[10px] text-muted-foreground">
                  {h.exchange}
                </span>
              </span>
              {h.name ? (
                <span className="truncate text-[10px] text-muted-foreground">
                  {h.name}
                </span>
              ) : null}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/sidebar-search.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/sidebar-search.tsx tests/components/stocks/sidebar-search.test.tsx
git commit -m "feat(stocks): SidebarSearch — debounced symbol search + navigate"
```

---

## Task 14: `TopGainersList` (server)

**Files:**
- Create: `src/components/stocks/top-gainers-list.tsx`
- Test: `tests/components/stocks/top-gainers-list.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/top-gainers-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/market/top-gainers", () => ({
  getTopGainers: async () => [
    { symbol: "ADANIENT", name: "Adani Ent", lastPrice: 2400, changePct: 4.21 },
    { symbol: "TATASTEEL", name: "Tata Steel", lastPrice: 140, changePct: 3.18 },
  ],
}));

import { TopGainersList } from "@/components/stocks/top-gainers-list";

describe("<TopGainersList />", () => {
  it("renders rows as links, with the active symbol highlighted", async () => {
    const Tree = await TopGainersList({ activeSymbol: "TATASTEEL" });
    render(Tree);
    const adani = screen.getByRole("link", { name: /ADANIENT/i });
    expect(adani).toHaveAttribute("href", "/stocks/ADANIENT?exchange=NSE");

    const tata = screen.getByRole("link", { name: /TATASTEEL/i });
    expect(tata).toHaveClass("bg-accent/50");
    expect(screen.getByText("+4.21%")).toHaveClass("text-success");
  });

  it("renders the empty state when the list is empty", async () => {
    vi.doMock("@/lib/market/top-gainers", () => ({ getTopGainers: async () => [] }));
    vi.resetModules();
    const { TopGainersList: Empty } = await import("@/components/stocks/top-gainers-list");
    const Tree = await Empty({ activeSymbol: "" });
    render(Tree);
    expect(screen.getByText(/Couldn't load top gainers/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/top-gainers-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TopGainersList`**

Create `src/components/stocks/top-gainers-list.tsx`:

```tsx
import Link from "next/link";

import { getTopGainers } from "@/lib/market/top-gainers";
import { cn, formatPercent } from "@/lib/utils";

interface Props {
  activeSymbol: string;
}

export async function TopGainersList({ activeSymbol }: Props) {
  const rows = await getTopGainers();
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Top gainers · Nifty 50
      </div>
      <div className="max-h-64 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            Couldn&apos;t load top gainers.
          </p>
        ) : (
          rows.map((r) => {
            const active = r.symbol === activeSymbol;
            return (
              <Link
                key={r.symbol}
                href={`/stocks/${encodeURIComponent(r.symbol)}?exchange=NSE`}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1 text-xs",
                  active
                    ? "bg-accent/50 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="truncate font-medium">{r.symbol}</span>
                <span className="num text-success tabular-nums">
                  +{formatPercent(r.changePct)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/top-gainers-list.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/top-gainers-list.tsx tests/components/stocks/top-gainers-list.test.tsx
git commit -m "feat(stocks): TopGainersList — scrollable Nifty 50 gainers with active highlight"
```

---

## Task 15: `KeyDetailsPanel` (server)

**Files:**
- Create: `src/components/stocks/key-details-panel.tsx`
- Test: `tests/components/stocks/key-details-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/stocks/key-details-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const closes = Array.from({ length: 25 }, (_, i) => 100 + i); // BUY territory
vi.mock("@/lib/market/historical", () => ({
  getHistorical: async () => closes.map((c, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, "0")}`,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: 1000 + i,
  })),
}));

import { KeyDetailsPanel } from "@/components/stocks/key-details-panel";
import type { MetaInfo, Quote } from "@/lib/market/types";

const quote: Quote = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries",
  lastPrice: 2478.3,
  previousClose: 2460,
  open: 2460,
  dayHigh: 2480,
  dayLow: 2458,
  change: 18.3,
  changePct: 0.74,
  volume: 1_000_000,
  asOf: "2026-05-22T10:00:00Z",
};

const meta: MetaInfo = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries Ltd",
  industry: "Refineries",
  marketCap: 16_700_000_000_000,
};

describe("<KeyDetailsPanel />", () => {
  it("renders the name, price, avg vol, market cap, and BUY signal", async () => {
    const Tree = await KeyDetailsPanel({
      symbol: "RELIANCE",
      exchange: "NSE",
      quote,
      meta,
    });
    render(Tree);
    expect(screen.getByText("Reliance Industries Ltd")).toBeInTheDocument();
    expect(screen.getByText(/2,478\.30/)).toBeInTheDocument();
    expect(screen.getByText("BUY")).toBeInTheDocument();
  });

  it("renders em-dash for market cap when meta.marketCap is null", async () => {
    const Tree = await KeyDetailsPanel({
      symbol: "RELIANCE",
      exchange: "BSE",
      quote: { ...quote, exchange: "BSE" },
      meta: { ...meta, marketCap: null },
    });
    render(Tree);
    const mktCapRow = screen.getByText("Mkt cap").parentElement!;
    expect(mktCapRow).toHaveTextContent("—");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/stocks/key-details-panel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `KeyDetailsPanel`**

Create `src/components/stocks/key-details-panel.tsx`:

```tsx
import { SignalBadge } from "@/components/stocks/signal-badge";
import { getHistorical } from "@/lib/market/historical";
import { computeSignal } from "@/lib/market/signal";
import type { Exchange } from "@/types/database";
import type { MetaInfo, Quote } from "@/lib/market/types";
import { formatINR, formatNumber } from "@/lib/utils";

interface Props {
  symbol: string;
  exchange: Exchange;
  quote: Quote;
  meta: MetaInfo;
}

export async function KeyDetailsPanel({ symbol, exchange, quote, meta }: Props) {
  const candles = await getHistorical(symbol, exchange, "1M");
  const last30 = candles.slice(-30);
  const avgVol30d =
    last30.length === 0
      ? null
      : last30.reduce((sum, c) => sum + (c.volume ?? 0), 0) / last30.length;
  const signal = computeSignal(candles.map((c) => c.close));

  const name = meta.name ?? quote.name ?? "—";

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Key details
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-xs">
        <Row label="Name" value={<span className="truncate" title={name}>{name}</span>} />
        <Row label="Price" value={<span className="num tabular-nums">{formatINR(quote.lastPrice)}</span>} />
        <Row
          label="Avg vol (30d)"
          value={
            <span className="num tabular-nums">
              {avgVol30d == null ? "—" : formatNumber(Math.round(avgVol30d))}
            </span>
          }
        />
        <Row
          label="Mkt cap"
          value={
            <span className="num tabular-nums">
              {meta.marketCap == null
                ? "—"
                : formatINR(meta.marketCap, { compact: true })}
            </span>
          }
        />
        <Row label="Signal" value={<SignalBadge value={signal} />} />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/stocks/key-details-panel.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/stocks/key-details-panel.tsx tests/components/stocks/key-details-panel.test.tsx
git commit -m "feat(stocks): KeyDetailsPanel — name/price/avg vol/mkt cap/signal"
```

---

## Task 16: `SidebarToggle` (mobile drawer)

**Files:**
- Create: `src/components/stocks/sidebar-toggle.tsx`

- [ ] **Step 1: Implement**

Create `src/components/stocks/sidebar-toggle.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SidebarToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open stock rail"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="right-0 top-0 h-full w-[280px] max-w-full translate-x-0 translate-y-0 rounded-none border-l p-3 sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stocks
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/stocks/sidebar-toggle.tsx
git commit -m "feat(stocks): SidebarToggle — mobile Dialog drawer for the rail"
```

---

## Task 17: Stitch `page.tsx` and `loading.tsx`

**Files:**
- Create: `src/app/(app)/stocks/[symbol]/page.tsx`
- Create: `src/app/(app)/stocks/[symbol]/loading.tsx`

- [ ] **Step 1: Implement `loading.tsx`**

Create `src/app/(app)/stocks/[symbol]/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function StockLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-80 w-full" />
        </div>
        <aside className="hidden md:flex md:flex-col md:gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-36 w-full" />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `page.tsx`**

Create `src/app/(app)/stocks/[symbol]/page.tsx`:

```tsx
import { Suspense } from "react";

import { KeyDetailsPanel } from "@/components/stocks/key-details-panel";
import { SidebarSearch } from "@/components/stocks/sidebar-search";
import { SidebarToggle } from "@/components/stocks/sidebar-toggle";
import { StockHeader } from "@/components/stocks/stock-header";
import { TimeframeChart } from "@/components/stocks/timeframe-chart";
import { TopGainersList } from "@/components/stocks/top-gainers-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getHistorical } from "@/lib/market/historical";
import { getMetaInfo } from "@/lib/market/meta";
import { getQuote } from "@/lib/market/nse";
import { parseExchange } from "@/lib/market/symbols";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ exchange?: string }>;
}

export default async function StockPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const exchange = parseExchange((await searchParams).exchange);
  const [quote, meta] = await Promise.all([
    getQuote(symbol, exchange),
    getMetaInfo(symbol, exchange),
  ]);

  const Rail = (
    <>
      <SidebarSearch />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TopGainersList activeSymbol={quote.symbol} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <KeyDetailsPanel
          symbol={symbol}
          exchange={exchange}
          quote={quote}
          meta={meta}
        />
      </Suspense>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="md:hidden">
        <SidebarToggle>{Rail}</SidebarToggle>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-3">
          <StockHeader quote={quote} meta={meta} />
          <Suspense fallback={<Skeleton className="h-80 w-full" />}>
            <ChartPanel symbol={symbol} exchange={exchange} />
          </Suspense>
        </div>
        <aside className="hidden md:flex md:flex-col md:gap-3">{Rail}</aside>
      </div>
    </div>
  );
}

async function ChartPanel({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: ReturnType<typeof parseExchange>;
}) {
  const candles = await getHistorical(symbol, exchange, "3M");
  return <TimeframeChart initial={candles} symbol={symbol} exchange={exchange} />;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/stocks/\[symbol\]/page.tsx src/app/\(app\)/stocks/\[symbol\]/loading.tsx
git commit -m "feat(stocks): /stocks/[symbol] page with streamed panels"
```

---

## Task 18: Wire markets-page search suggestions to navigate

**Files:**
- Modify: `src/components/markets/symbol-search.tsx`

- [ ] **Step 1: Update the suggestion row to be a `<Link>`**

Edit `src/components/markets/symbol-search.tsx`. Add `Link` to the imports:

```tsx
import Link from "next/link";
```

Replace the existing `<li>` block (the inner `hits.map(...)` body) with this `<li>` that holds a `<Link>`:

```tsx
{hits.map((h) => (
  <li key={`${h.exchange}:${h.symbol}`}>
    <Link
      href={`/stocks/${encodeURIComponent(h.symbol)}?exchange=${h.exchange}`}
      className="flex items-center justify-between px-3 py-2 hover:bg-accent"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{h.symbol}</span>
          <Badge variant="outline" className="text-[10px]">
            {h.exchange}
          </Badge>
        </div>
        {h.name ? (
          <p className="text-xs text-muted-foreground">{h.name}</p>
        ) : null}
      </div>
    </Link>
  </li>
))}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/markets/symbol-search.tsx
git commit -m "feat(markets): link search suggestions to /stocks/[symbol]"
```

---

## Task 19: Full verification pass

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: exit 0 (no new warnings or errors in any of the new files).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass; no regressions in pre-existing suites.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Manual smoke test in dev**

Run: `npm run dev`

Walk through the manual checklist from the spec:
1. Markets page → type a symbol → click a suggestion → land on `/stocks/SYM?exchange=NSE`.
2. Toggle the NSE/BSE dropdown → URL updates; key details and chart reflect the new exchange (BSE shows the empty chart state and `—` for mkt cap).
3. Click 1M / 3M / 6M / 1Y → chart re-fetches; no jarring flash.
4. Click "Full Chart →" → toast "Full Chart — coming soon".
5. Click a top-gainer row → URL updates; active row highlight moves.
6. Resize to `< md` → rail hides, Menu button appears; tap → drawer opens with the rail content.
7. Visit `/stocks/NOTAREALSYMBOL` → the existing `(app)/error.tsx` boundary renders, no white screen.

- [ ] **Step 6: Final commit (if any leftover changes from manual cleanup)**

```bash
git status
# only commit if there are stray changes:
# git add -p && git commit -m "chore(stocks): manual smoke cleanup"
```

---

## Self-review

**Spec coverage:**
- Routing `/stocks/[symbol]?exchange=…` → Task 17.
- Large company name → Task 12.
- NSE/BSE dropdown → Task 9.
- Embedded chart with 1M/3M/6M/1Y → Task 11.
- Full Chart stub button (top-right of chart) → Tasks 10 + 11.
- Right rail: search → Task 13.
- Top 20 Nifty 50 gainers → Tasks 5 + 14.
- Key details (name, price, avg vol 30d, mkt cap, signal) → Task 15.
- Signal heuristic (SMA20 + 5-day momentum) → Task 2 + Task 15.
- Mobile drawer → Tasks 16 + 17.
- Server Components + per-panel Suspense → Task 17.
- Cache shape (memory + DB) for historical → Task 4.
- Cache for top gainers (60 s mem) → Task 5.
- Cache for meta (1 hr mem) → Task 6.
- `historical_cache` table → Task 3.
- `/api/historical/[symbol]` route → Task 7.
- Markets-page suggestion → `/stocks/…` link → Task 18.
- Tests for `computeSignal`, `getHistorical` range mapping, top-gainers sort/slice, route validation, `TimeframeChart` fetch + error, `ExchangeSelect` router, `SidebarSearch` debounce + navigate, list/panel rendering → covered across tasks 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15.

**Placeholders / red flags:** None — every step contains code or a concrete command.

**Type consistency:** `Range`, `HistoricalCandle`, `TopMover`, `MetaInfo`, `Signal` defined once in Task 1 and used unchanged downstream. `parseExchange` and `normalizeSymbol` reused from existing helpers without redefinition.
