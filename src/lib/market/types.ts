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

export interface LatestEarnings {
  /** ISO date of the most recent earnings report ("YYYY-MM-DD"), if known. */
  reportDate: string | null;
  /** Calendar label such as "Q4 2025". */
  period: string | null;
  /** Reported EPS for the period (per-share, native currency). */
  eps: number | null;
  /** Reported revenue for the period (native currency). */
  revenue: number | null;
}

export interface Fundamentals {
  symbol: string;
  exchange: Exchange;
  marketCap: number | null;
  /** Indicated dividend yield as a percent (e.g. 2.5 means 2.5%). */
  dividendYieldPct: number | null;
  /** Trailing twelve-month P/E ratio. */
  trailingPE: number | null;
  /** Trailing twelve-month basic EPS. */
  basicEpsTTM: number | null;
  /** Most recent full-fiscal-year net income. */
  netIncomeFY: number | null;
  /** Most recent full-fiscal-year revenue. */
  revenueFY: number | null;
  /** Floating share count. */
  floatShares: number | null;
  /** 1-year beta vs the broad market. */
  beta: number | null;
  /** Latest reported quarter snapshot. */
  earnings: LatestEarnings | null;
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
