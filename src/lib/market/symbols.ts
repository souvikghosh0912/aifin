import type { Exchange } from "@/types/database";

const SUFFIX_NSE = /\.NS$/i;
const SUFFIX_BSE = /\.BO$/i;

/**
 * Normalize a user-entered ticker into the upstream-friendly form.
 * Strips Yahoo-style suffixes (.NS, .BO), uppercases, trims.
 */
export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(SUFFIX_NSE, "").replace(SUFFIX_BSE, "");
}

export function parseExchange(input: string | null | undefined): Exchange {
  const v = (input ?? "").trim().toUpperCase();
  return v === "BSE" ? "BSE" : "NSE";
}

/**
 * Stable cache key for a (symbol, exchange) pair.
 */
export function quoteKey(symbol: string, exchange: Exchange): string {
  return `${exchange}:${normalizeSymbol(symbol)}`;
}
