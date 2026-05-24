import "server-only";

import { nseBucket } from "./rate-limit";
import {
  INDICES,
  STOCKS,
  findMarketEntry,
  getMarketIndices,
  getMarketStocks,
  type MarketEntry,
  type MarketKind,
} from "./markets-catalog";
import {
  type HistoricalCandle,
  MarketDataError,
  type MarketsRange,
} from "./types";
import {
  fetchHistoricalRawYahoo,
  fetchHistoricalYahoo,
  fetchSparkYahoo,
  fetchSparkYahooRaw,
} from "./yahoo";

/**
 * Markets-page catalog: hand-picked indices and large-cap stocks shown in
 * the two carousels. Pure data lives in `./markets-catalog` so client
 * components (e.g. the search modal) can read it without dragging in the
 * server-only Yahoo fetchers.
 */

export {
  INDICES,
  STOCKS,
  findMarketEntry,
  getMarketIndices,
  getMarketStocks,
};
export type { MarketEntry, MarketKind };

export interface MarketQuoteSnapshot {
  id: string;
  lastPrice: number | null;
  change: number | null;
  changePct: number | null;
}

/**
 * Best-effort batched quote fetch. Indices go through the raw-symbol spark
 * path, stocks go through the suffix-aware spark path; failures collapse to
 * null fields so the carousel still renders.
 */
export async function fetchMarketQuotes(
  entries: MarketEntry[],
): Promise<MarketQuoteSnapshot[]> {
  const indices = entries.filter((e) => e.kind === "index");
  const stocks = entries.filter((e) => e.kind === "stock");

  await nseBucket.acquire();
  const [indexSparks, stockSparks] = await Promise.all([
    indices.length > 0
      ? fetchSparkYahooRaw(indices.map((e) => e.yahooSymbol)).catch(() => [])
      : Promise.resolve([]),
    stocks.length > 0
      ? fetchSparkYahoo(
          stocks.map((e) => e.symbol),
          "NSE",
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const indexBySymbol = new Map(indexSparks.map((s) => [s.symbol, s]));
  const stockBySymbol = new Map(stockSparks.map((s) => [s.symbol, s]));

  return entries.map((e) => {
    const hit =
      e.kind === "index"
        ? indexBySymbol.get(e.yahooSymbol)
        : stockBySymbol.get(e.symbol);
    if (!hit) {
      return { id: e.id, lastPrice: null, change: null, changePct: null };
    }
    return {
      id: e.id,
      lastPrice: hit.lastPrice,
      change: hit.change,
      changePct: hit.changePct,
    };
  });
}

/** Fetch historical candles for any market entry. */
export async function fetchMarketHistorical(
  entry: MarketEntry,
  range: MarketsRange,
): Promise<HistoricalCandle[]> {
  await nseBucket.acquire();
  try {
    if (entry.kind === "index") {
      return await fetchHistoricalRawYahoo(entry.yahooSymbol, range);
    }
    return await fetchHistoricalYahoo(entry.symbol, entry.exchange, range);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError(
      `Markets historical fetch failed for ${entry.id}`,
      err,
    );
  }
}
