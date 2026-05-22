import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Exchange } from "@/types/database";

import { quoteKey } from "./symbols";
import type { Quote } from "./types";

interface CacheEntry {
  value: Quote;
  expiresAt: number;
}

const MEM_TTL_MS = 30_000; // in-memory LRU TTL
const DB_TTL_MS = 5 * 60_000; // Postgres fallback TTL
const MAX_MEM_ENTRIES = 500;

const mem = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Quote>>();

function memGet(key: string): Quote | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  // refresh recency
  mem.delete(key);
  mem.set(key, e);
  return e.value;
}

function memSet(key: string, value: Quote) {
  if (mem.size >= MAX_MEM_ENTRIES) {
    const first = mem.keys().next().value;
    if (first) mem.delete(first);
  }
  mem.set(key, { value, expiresAt: Date.now() + MEM_TTL_MS });
}

async function dbGet(symbol: string, exchange: Exchange): Promise<Quote | null> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("quote_cache")
      .select("payload, fetched_at")
      .eq("symbol", symbol)
      .eq("exchange", exchange)
      .maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > DB_TTL_MS) return null;
    return data.payload as unknown as Quote;
  } catch {
    return null;
  }
}

async function dbSet(quote: Quote): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("quote_cache").upsert({
      symbol: quote.symbol,
      exchange: quote.exchange,
      payload: quote as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    });
  } catch {
    // best-effort cache write; never fail the request
  }
}

/**
 * Cached quote lookup. Coalesces concurrent requests for the same key.
 *
 * Order: memory LRU → Postgres → upstream fetcher.
 */
export async function getCachedQuote(
  symbol: string,
  exchange: Exchange,
  fetcher: () => Promise<Quote>,
): Promise<Quote> {
  const key = quoteKey(symbol, exchange);

  const hit = memGet(key);
  if (hit) return hit;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const fromDb = await dbGet(symbol, exchange);
      if (fromDb) {
        memSet(key, fromDb);
        return fromDb;
      }
      const fresh = await fetcher();
      memSet(key, fresh);
      void dbSet(fresh);
      return fresh;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
