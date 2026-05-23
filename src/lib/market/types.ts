/**
 * Normalized market data types.
 * The shapes returned by upstream packages vary; everything that crosses
 * the API boundary uses these stable types.
 */
import type { Exchange } from "@/types/database";

export interface Quote {
  symbol: string;
  exchange: Exchange;
  name: string | null;
  lastPrice: number;
  previousClose: number;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  change: number;
  changePct: number;
  volume: number | null;
  /** ISO timestamp of last upstream tick (best effort) */
  asOf: string;
}

export interface SymbolSearchHit {
  symbol: string;
  exchange: Exchange;
  name: string | null;
}

export interface IndexQuote {
  name: string;
  last: number;
  change: number;
  changePct: number;
}

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
  change: number;
  changePct: number;
}

export interface MetaInfo {
  symbol: string;
  exchange: Exchange;
  name: string | null;
  industry: string | null;
  marketCap: number | null;
}

export type Signal = "BUY" | "SELL" | "NEUTRAL";

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
