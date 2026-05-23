import "server-only";
import path from "node:path";
import os from "node:os";

// Search and quote data now come from Yahoo Finance (see ./yahoo.ts). NSE
// sits behind Akamai Bot Manager — every nse-bse-api call returns a fake 404
// from a real production IP — so the package is unusable for those endpoints.
// We still hold a lazy nse-bse-api client around for getIndices(), which we
// haven't migrated yet; that call will surface as "Index data unavailable"
// when Akamai blocks it.
import type { Exchange } from "@/types/database";

import { getCachedQuote } from "./cache";
import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import {
  MarketDataError,
  type IndexQuote,
  type Quote,
  type SymbolSearchHit,
} from "./types";
import { fetchQuoteYahoo, searchSymbolsYahoo } from "./yahoo";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UpstreamClients {
  nse: any;
  bse: any;
}

let _clients: UpstreamClients | null = null;

function getDownloadDir(exchange: "nse" | "bse") {
  return path.join(os.tmpdir(), "ai-finance-dashboard", "nse-bse-api", exchange);
}

function resetClients() {
  _clients = null;
}

async function getClients(): Promise<UpstreamClients> {
  if (_clients) return _clients;
  try {
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
    throw new MarketDataError(message, err);
  }
}

async function fetchQuoteUncached(
  symbol: string,
  exchange: Exchange,
): Promise<Quote> {
  await nseBucket.acquire();
  return fetchQuoteYahoo(symbol, exchange);
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
  return searchSymbolsYahoo(query);
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
  } catch (err) {
    resetClients();
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError("Failed to fetch NSE indices", err);
  }
}
