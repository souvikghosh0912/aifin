import "server-only";

import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import {
  type HistoricalCandle,
  MarketDataError,
  type Range,
} from "./types";
import {
  fetchHistoricalRawYahoo,
  fetchHistoricalYahoo,
  fetchSparkYahoo,
  fetchSparkYahooRaw,
} from "./yahoo";

/**
 * Markets-page catalog: hand-picked indices and large-cap stocks shown in
 * the two carousels. Order matters — the page paginates 4 at a time, so each
 * pair of 4 forms one "slide". The Yahoo symbol map is kept here so the rest
 * of the app never needs to know which symbol form the upstream API wants.
 */

export type MarketKind = "index" | "stock";

export interface MarketEntry {
  /** Stable URL/slug for routing through the markets API. */
  id: string;
  kind: MarketKind;
  /** Display label on the card (e.g. "Nifty 50" or "Reliance Industries"). */
  name: string;
  /** Short ticker label (e.g. "NIFTY", "RELIANCE"). */
  shortName: string;
  /** Bare symbol for stocks (used with NSE suffix downstream). */
  symbol: string;
  /** Exchange for the stock variant; "NSE" for indices by convention. */
  exchange: Exchange;
  /** Fully-qualified Yahoo symbol for raw fetches (indices only). */
  yahooSymbol: string;
}

const INDICES: MarketEntry[] = [
  { id: "nifty-50", kind: "index", name: "Nifty 50", shortName: "NIFTY", symbol: "NIFTY", exchange: "NSE", yahooSymbol: "^NSEI" },
  { id: "sensex", kind: "index", name: "Sensex", shortName: "SENSEX", symbol: "SENSEX", exchange: "BSE", yahooSymbol: "^BSESN" },
  { id: "nifty-bank", kind: "index", name: "Nifty Bank", shortName: "BANKNIFTY", symbol: "BANKNIFTY", exchange: "NSE", yahooSymbol: "^NSEBANK" },
  { id: "nifty-it", kind: "index", name: "Nifty IT", shortName: "NIFTYIT", symbol: "NIFTYIT", exchange: "NSE", yahooSymbol: "^CNXIT" },
  { id: "nifty-100", kind: "index", name: "Nifty 100", shortName: "NIFTY100", symbol: "NIFTY100", exchange: "NSE", yahooSymbol: "^CNX100" },
  { id: "nifty-midcap", kind: "index", name: "Nifty MidCap", shortName: "MIDCAP", symbol: "MIDCAP", exchange: "NSE", yahooSymbol: "^NSEMDCP50" },
  { id: "nifty-auto", kind: "index", name: "Nifty Auto", shortName: "NIFTYAUTO", symbol: "NIFTYAUTO", exchange: "NSE", yahooSymbol: "^CNXAUTO" },
  { id: "nifty-pharma", kind: "index", name: "Nifty Pharma", shortName: "NIFTYPHARMA", symbol: "NIFTYPHARMA", exchange: "NSE", yahooSymbol: "^CNXPHARMA" },
];

const STOCKS: MarketEntry[] = [
  { id: "reliance", kind: "stock", name: "Reliance Industries", shortName: "RELIANCE", symbol: "RELIANCE", exchange: "NSE", yahooSymbol: "RELIANCE.NS" },
  { id: "tcs", kind: "stock", name: "Tata Consultancy Services", shortName: "TCS", symbol: "TCS", exchange: "NSE", yahooSymbol: "TCS.NS" },
  { id: "hdfcbank", kind: "stock", name: "HDFC Bank", shortName: "HDFCBANK", symbol: "HDFCBANK", exchange: "NSE", yahooSymbol: "HDFCBANK.NS" },
  { id: "icicibank", kind: "stock", name: "ICICI Bank", shortName: "ICICIBANK", symbol: "ICICIBANK", exchange: "NSE", yahooSymbol: "ICICIBANK.NS" },
  { id: "itc", kind: "stock", name: "ITC", shortName: "ITC", symbol: "ITC", exchange: "NSE", yahooSymbol: "ITC.NS" },
  { id: "infy", kind: "stock", name: "Infosys", shortName: "INFY", symbol: "INFY", exchange: "NSE", yahooSymbol: "INFY.NS" },
  { id: "wipro", kind: "stock", name: "Wipro", shortName: "WIPRO", symbol: "WIPRO", exchange: "NSE", yahooSymbol: "WIPRO.NS" },
  { id: "hindunilvr", kind: "stock", name: "Hindustan Unilever", shortName: "HINDUNILVR", symbol: "HINDUNILVR", exchange: "NSE", yahooSymbol: "HINDUNILVR.NS" },
];

const ALL = [...INDICES, ...STOCKS];
const BY_ID = new Map(ALL.map((e) => [e.id, e]));

export function getMarketIndices(): MarketEntry[] {
  return INDICES;
}

export function getMarketStocks(): MarketEntry[] {
  return STOCKS;
}

export function findMarketEntry(id: string): MarketEntry | null {
  return BY_ID.get(id) ?? null;
}

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
  range: Range,
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
