import type { Exchange } from "@/types/database";

/**
 * Static catalog for the markets page carousels and the symbol-search modal.
 * Lives in its own module (no `server-only` import) so client components can
 * read the same canonical list the server uses without duplication.
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

export const INDICES: MarketEntry[] = [
  { id: "nifty-50", kind: "index", name: "Nifty 50", shortName: "NIFTY", symbol: "NIFTY", exchange: "NSE", yahooSymbol: "^NSEI" },
  { id: "sensex", kind: "index", name: "Sensex", shortName: "SENSEX", symbol: "SENSEX", exchange: "BSE", yahooSymbol: "^BSESN" },
  { id: "nifty-bank", kind: "index", name: "Nifty Bank", shortName: "BANKNIFTY", symbol: "BANKNIFTY", exchange: "NSE", yahooSymbol: "^NSEBANK" },
  { id: "nifty-it", kind: "index", name: "Nifty IT", shortName: "NIFTYIT", symbol: "NIFTYIT", exchange: "NSE", yahooSymbol: "^CNXIT" },
  { id: "nifty-100", kind: "index", name: "Nifty 100", shortName: "NIFTY100", symbol: "NIFTY100", exchange: "NSE", yahooSymbol: "^CNX100" },
  { id: "nifty-midcap", kind: "index", name: "Nifty MidCap", shortName: "MIDCAP", symbol: "MIDCAP", exchange: "NSE", yahooSymbol: "^NSEMDCP50" },
  { id: "nifty-auto", kind: "index", name: "Nifty Auto", shortName: "NIFTYAUTO", symbol: "NIFTYAUTO", exchange: "NSE", yahooSymbol: "^CNXAUTO" },
  { id: "nifty-pharma", kind: "index", name: "Nifty Pharma", shortName: "NIFTYPHARMA", symbol: "NIFTYPHARMA", exchange: "NSE", yahooSymbol: "^CNXPHARMA" },
];

export const STOCKS: MarketEntry[] = [
  { id: "reliance", kind: "stock", name: "Reliance Industries", shortName: "RELIANCE", symbol: "RELIANCE", exchange: "NSE", yahooSymbol: "RELIANCE.NS" },
  { id: "tcs", kind: "stock", name: "Tata Consultancy Services", shortName: "TCS", symbol: "TCS", exchange: "NSE", yahooSymbol: "TCS.NS" },
  { id: "hdfcbank", kind: "stock", name: "HDFC Bank", shortName: "HDFCBANK", symbol: "HDFCBANK", exchange: "NSE", yahooSymbol: "HDFCBANK.NS" },
  { id: "icicibank", kind: "stock", name: "ICICI Bank", shortName: "ICICIBANK", symbol: "ICICIBANK", exchange: "NSE", yahooSymbol: "ICICIBANK.NS" },
  { id: "itc", kind: "stock", name: "ITC", shortName: "ITC", symbol: "ITC", exchange: "NSE", yahooSymbol: "ITC.NS" },
  { id: "infy", kind: "stock", name: "Infosys", shortName: "INFY", symbol: "INFY", exchange: "NSE", yahooSymbol: "INFY.NS" },
  { id: "wipro", kind: "stock", name: "Wipro", shortName: "WIPRO", symbol: "WIPRO", exchange: "NSE", yahooSymbol: "WIPRO.NS" },
  { id: "hindunilvr", kind: "stock", name: "Hindustan Unilever", shortName: "HINDUNILVR", symbol: "HINDUNILVR", exchange: "NSE", yahooSymbol: "HINDUNILVR.NS" },
];

export const ALL_MARKETS: MarketEntry[] = [...INDICES, ...STOCKS];

const BY_ID = new Map(ALL_MARKETS.map((e) => [e.id, e]));

export function findMarketEntry(id: string): MarketEntry | null {
  return BY_ID.get(id) ?? null;
}

export function getMarketIndices(): MarketEntry[] {
  return INDICES;
}

export function getMarketStocks(): MarketEntry[] {
  return STOCKS;
}
