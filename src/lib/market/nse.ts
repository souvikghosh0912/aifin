import "server-only";
import path from "node:path";
import os from "node:os";

// NOTE: `nse-bse-api` is dynamically imported so that bundling doesn't try to
// resolve its Node-only dependencies at edge runtime. This file must only be
// imported from Node-runtime route handlers / Server Actions.
import type { Exchange } from "@/types/database";

import { getCachedQuote } from "./cache";
import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import { MarketDataError, type IndexQuote, type Quote, type SymbolSearchHit } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UpstreamClients {
  nse: any;
  bse: any;
}

let _clients: UpstreamClients | null = null;

function getDownloadDir(exchange: "nse" | "bse") {
  return path.join(os.tmpdir(), "ai-finance-dashboard", "nse-bse-api", exchange);
}

async function getClients(): Promise<UpstreamClients> {
  if (_clients) return _clients;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: any = await import("nse-bse-api");
    const NSE = mod.NSE ?? mod.default?.NSE;
    const BSE = mod.BSE ?? mod.default?.BSE;
    if (!NSE || !BSE) {
      throw new Error("nse-bse-api: NSE/BSE exports not found");
    }
    _clients = {
      nse: new NSE(getDownloadDir("nse"), { timeout: 10_000 }),
      bse: new BSE({
        downloadFolder: getDownloadDir("bse"),
        timeout: 10_000,
      }),
    };
    return _clients;
  } catch (err) {
    const message =
      err instanceof Error
        ? `Failed to initialize nse-bse-api clients: ${err.message}`
        : "Failed to initialize nse-bse-api clients.";
    throw new MarketDataError(
      message,
      err,
    );
  }
}

/**
 * Coerce whatever the upstream returns into our normalized Quote shape.
 * The package's response shape is loose, so we look at common field names.
 */
function normalizeQuote(
  raw: any,
  symbol: string,
  exchange: Exchange,
): Quote {
  if (!raw || typeof raw !== "object") {
    throw new MarketDataError(`Empty quote payload for ${exchange}:${symbol}`);
  }

  const info = raw.info ?? raw.metadata ?? {};
  const priceInfo = raw.priceInfo ?? raw.price ?? raw;
  const securityWiseDP = raw.securityWiseDP ?? raw.tradedInfo ?? {};

  const lastPrice = Number(
    priceInfo.lastPrice ?? priceInfo.ltp ?? raw.lastPrice ?? raw.LTP ?? NaN,
  );
  const previousClose = Number(
    priceInfo.previousClose ??
      priceInfo.prevClose ??
      raw.previousClose ??
      raw.PrevClose ??
      NaN,
  );

  if (!Number.isFinite(lastPrice) || !Number.isFinite(previousClose)) {
    throw new MarketDataError(
      `Unrecognized quote payload for ${exchange}:${symbol}`,
    );
  }

  const change = Number(
    priceInfo.change ?? raw.change ?? lastPrice - previousClose,
  );
  const changePct = Number(
    priceInfo.pChange ?? raw.pChange ?? raw.changePercent ?? (change / previousClose) * 100,
  );

  return {
    symbol: normalizeSymbol(symbol),
    exchange,
    name: info.companyName ?? info.symbol ?? raw.companyName ?? null,
    lastPrice,
    previousClose,
    open: numOrNull(priceInfo.open ?? priceInfo.intraDayHighLow?.value),
    dayHigh: numOrNull(
      priceInfo.intraDayHighLow?.max ?? priceInfo.dayHigh ?? raw.dayHigh,
    ),
    dayLow: numOrNull(
      priceInfo.intraDayHighLow?.min ?? priceInfo.dayLow ?? raw.dayLow,
    ),
    change,
    changePct,
    volume: numOrNull(securityWiseDP.quantityTraded ?? raw.totalTradedVolume),
    asOf: new Date().toISOString(),
  };
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchQuoteUncached(
  symbol: string,
  exchange: Exchange,
): Promise<Quote> {
  await nseBucket.acquire();
  const clients = await getClients();
  const sym = normalizeSymbol(symbol);

  try {
    const raw =
      exchange === "NSE"
        ? await clients.nse.quote({ symbol: sym, type: "equity" })
        : await clients.bse.quote(sym);
    return normalizeQuote(raw, sym, exchange);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError(
      `Upstream quote fetch failed for ${exchange}:${sym}`,
      err,
    );
  }
}

export function getQuote(symbol: string, exchange: Exchange): Promise<Quote> {
  return getCachedQuote(symbol, exchange, () =>
    fetchQuoteUncached(symbol, exchange),
  );
}

export async function getQuotes(
  items: Array<{ symbol: string; exchange: Exchange }>,
): Promise<Record<string, Quote | { error: string }>> {
  const results = await Promise.allSettled(
    items.map((i) => getQuote(i.symbol, i.exchange)),
  );
  const out: Record<string, Quote | { error: string }> = {};
  results.forEach((res, idx) => {
    const item = items[idx];
    if (!item) return;
    const key = `${item.exchange}:${normalizeSymbol(item.symbol)}`;
    if (res.status === "fulfilled") {
      out[key] = res.value;
    } else {
      out[key] = {
        error:
          res.reason instanceof Error ? res.reason.message : "fetch_failed",
      };
    }
  });
  return out;
}

export async function searchSymbols(
  query: string,
): Promise<SymbolSearchHit[]> {
  if (!query.trim()) return [];
  await nseBucket.acquire();
  const clients = await getClients();
  try {
    const fn =
      clients.nse.lookup ??
      clients.nse.market?.lookup ??
      clients.nse.search ??
      clients.nse.symbolSearch ??
      clients.nse.searchEquity;
    if (!fn) return [];
    const raw = await fn.call(
      fn === clients.nse.market?.lookup ? clients.nse.market : clients.nse,
      query.trim(),
    );
    const list: any[] = Array.isArray(raw)
      ? raw
      : raw?.symbols ??
        raw?.data ??
        raw?.result ??
        raw?.items ??
        [];
    return list
      .slice(0, 25)
      .map((r: any) => ({
        symbol: String(
          r.symbol ??
            r.SYMBOL ??
            r.symbol_info ??
            r.value ??
            r.code ??
            "",
        ).toUpperCase(),
        exchange: "NSE" as Exchange,
        name:
          r.companyName ??
          r.name ??
          r.identifier ??
          r.securityName ??
          null,
      }))
      .filter((h: SymbolSearchHit) => h.symbol.length > 0);
  } catch {
    return [];
  }
}

export async function getIndices(): Promise<IndexQuote[]> {
  await nseBucket.acquire();
  const clients = await getClients();
  try {
    const fn =
      clients.nse.listIndices ??
      clients.nse.indices ??
      clients.nse.getAllIndices ??
      clients.nse.allIndices;
    const raw = fn ? await fn.call(clients.nse) : null;
    if (!raw) return [];
    const list: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
    return list.slice(0, 12).map((r: any) => ({
      name: String(r.index ?? r.indexSymbol ?? r.name ?? "—"),
      last: Number(r.last ?? r.lastPrice ?? 0),
      change: Number(r.variation ?? r.change ?? 0),
      changePct: Number(r.percentChange ?? r.pChange ?? 0),
    }));
  } catch {
    return [];
  }
}
