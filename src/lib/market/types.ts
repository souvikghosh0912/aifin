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

/**
 * Wider range set used by the markets page chart. Adds intraday (1D, served
 * via 5-minute bars) plus multi-year buckets. Kept separate from `Range` so
 * the historical_cache DB column and shared getHistorical pipeline keep
 * their narrower contract.
 */
export type MarketsRange = Range | "1D" | "5Y" | "MAX";

export interface HistoricalCandle {
  /**
   * ISO date "YYYY-MM-DD" for daily bars, or a full ISO timestamp for
   * intraday bars (e.g. the 1D range on the markets page).
   */
  date: string;
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

export interface CompanyProfile {
  symbol: string;
  exchange: Exchange;
  /** Broad classification (e.g. "Financial Services"). */
  sector: string | null;
  /** Narrower classification (e.g. "Major Banks"). */
  industry: string | null;
  /** Best-effort current chief executive — first officer with "CEO" in their title. */
  ceo: string | null;
  /** Bare hostname (e.g. "hdfcbank.com") suitable for display + href via `https://`. */
  website: string | null;
  /** Headquarters city / locality. */
  headquarters: string | null;
  /** Year the company was founded. */
  founded: number | null;
  /** ISO date "YYYY-MM-DD" of NSE listing (proxy for IPO date). */
  ipoDate: string | null;
  /** ISIN (International Securities Identification Number) — exchange registry code. */
  isin: string | null;
  /** CFI (Classification of Financial Instrument) code. Rarely available in upstream data. */
  cfiCode: string | null;
  /** Long-form business description from the issuer profile. */
  description: string | null;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
