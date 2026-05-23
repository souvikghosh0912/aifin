import "server-only";

import { type TopMover } from "./types";
import { fetchSparkYahoo } from "./yahoo";

const TTL_MS = 60_000;
let cache: { value: TopMover[]; expiresAt: number } | null = null;

// Static Nifty 50 constituents. Maintained by hand — adjust if NSE rebalances
// the index. We pull live prices for the whole list via a single Yahoo spark
// call and pick the top movers by % change. Avoiding a 50-way fan-out keeps
// the request cheap (one HTTP call) and uniformly rate-limited.
const NIFTY_50: string[] = [
  "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY",
  "ITC", "KOTAKBANK", "LT", "AXISBANK", "SBIN",
  "HINDUNILVR", "BHARTIARTL", "BAJFINANCE", "BAJAJFINSV", "HCLTECH",
  "ASIANPAINT", "MARUTI", "TITAN", "SUNPHARMA", "ULTRACEMCO",
  "NESTLEIND", "ONGC", "NTPC", "TATAMOTORS", "JSWSTEEL",
  "POWERGRID", "TATASTEEL", "INDUSINDBK", "COALINDIA", "ADANIENT",
  "GRASIM", "HEROMOTOCO", "BPCL", "CIPLA", "BRITANNIA",
  "DIVISLAB", "ADANIPORTS", "EICHERMOT", "APOLLOHOSP", "HINDALCO",
  "DRREDDY", "TECHM", "WIPRO", "TATACONSUM", "SBILIFE",
  "HDFCLIFE", "TRENT", "SHRIRAMFIN", "LTIM", "ADANIGREEN",
];

export async function getTopGainers(): Promise<TopMover[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    const sparks = await fetchSparkYahoo(NIFTY_50, "NSE");
    const movers: TopMover[] = sparks
      .map((s) => ({
        symbol: s.symbol,
        name: null,
        lastPrice: s.lastPrice,
        change: s.change,
        changePct: s.changePct,
      }))
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 20);

    cache = { value: movers, expiresAt: Date.now() + TTL_MS };
    return movers;
  } catch {
    return [];
  }
}
