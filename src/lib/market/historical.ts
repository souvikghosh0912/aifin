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
  const date = dateStr(
    raw.CH_TIMESTAMP ?? raw.mTIMESTAMP ?? raw.date ?? raw.timestamp,
  );
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
  if (exchange === "BSE") return [];

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
