import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import { type HistoricalCandle, type Range } from "./types";
import { fetchHistoricalYahoo } from "./yahoo";

const MEM_TTL_MS = 5 * 60_000;
const DB_TTL_MS = 60 * 60_000;
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

export async function getHistorical(
  symbol: string,
  exchange: Exchange,
  range: Range,
): Promise<HistoricalCandle[]> {
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
      const candles = await fetchHistoricalYahoo(sym, exchange, range);
      memSet(k, candles);
      void dbSet(sym, exchange, range, candles);
      return candles;
    } finally {
      inflight.delete(k);
    }
  })();

  inflight.set(k, promise);
  return promise;
}
