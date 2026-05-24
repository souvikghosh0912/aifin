import "server-only";

import type { Exchange } from "@/types/database";

import { normalizeSymbol } from "./symbols";
import {
  MarketDataError,
  type HistoricalCandle,
  type Quote,
  type Range,
  type SymbolSearchHit,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Yahoo Finance public endpoints. The v8 chart endpoint and v1 search both
// work without auth; the older v7 quote endpoint started returning 401 in
// 2024 and we don't use it. nse-bse-api can't be used anymore because NSE
// sits behind Akamai Bot Manager which returns a fake 404 to any non-browser
// client.
const SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const SPARK_URL = "https://query1.finance.yahoo.com/v8/finance/spark";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const TIMEOUT_MS = 10_000;

function yahooSuffix(exchange: Exchange): string {
  return exchange === "BSE" ? ".BO" : ".NS";
}

function exchangeFromYahooSymbol(symbol: string): Exchange | null {
  if (/\.NS$/i.test(symbol)) return "NSE";
  if (/\.BO$/i.test(symbol)) return "BSE";
  return null;
}

async function yfetch(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) {
      throw new MarketDataError(`Yahoo ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    if ((err as { name?: string })?.name === "AbortError") {
      throw new MarketDataError(`Yahoo request timed out after ${TIMEOUT_MS}ms`);
    }
    throw new MarketDataError("Yahoo request failed", err);
  } finally {
    clearTimeout(timer);
  }
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function yahooRangeParam(range: Range): string {
  switch (range) {
    case "1M":
      return "1mo";
    case "3M":
      return "3mo";
    case "6M":
      return "6mo";
    case "1Y":
      return "1y";
  }
}

/**
 * Search NSE/BSE symbols via Yahoo Finance.
 *
 * Yahoo returns global results; we filter to entries with .NS/.BO suffixes
 * (Indian listings) and strip those suffixes back to bare tickers so the rest
 * of the app stays exchange-suffix-agnostic.
 */
export async function searchSymbolsYahoo(
  query: string,
): Promise<SymbolSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${SEARCH_URL}?q=${encodeURIComponent(q)}` +
    "&quotesCount=20&newsCount=0&listsCount=0&region=IN&lang=en-IN";

  let body: any;
  try {
    body = await yfetch(url);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError(`Symbol search failed for "${q}"`, err);
  }

  const quotes: any[] = Array.isArray(body?.quotes) ? body.quotes : [];
  const out: SymbolSearchHit[] = [];
  const seen = new Set<string>();
  for (const r of quotes) {
    const sym = String(r?.symbol ?? "");
    const ex = exchangeFromYahooSymbol(sym);
    if (!ex) continue;
    const bare = sym.replace(/\.(NS|BO)$/i, "").toUpperCase();
    if (!bare) continue;
    const key = `${ex}:${bare}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      symbol: bare,
      exchange: ex,
      name: r.longname ?? r.shortname ?? null,
    });
    if (out.length >= 25) break;
  }
  return out;
}

/**
 * Fetch a single quote via the Yahoo v8 chart endpoint. We only consume the
 * `meta` block which has everything we need (price, prev close, day range,
 * volume, name). The chart data itself is discarded.
 */
export async function fetchQuoteYahoo(
  symbol: string,
  exchange: Exchange,
): Promise<Quote> {
  const bare = normalizeSymbol(symbol);
  if (!bare) {
    throw new MarketDataError(`Empty symbol for ${exchange}`);
  }
  const suffixed = `${bare}${yahooSuffix(exchange)}`;
  const url = `${CHART_URL}/${encodeURIComponent(suffixed)}?interval=1d&range=1d`;

  let body: any;
  try {
    body = await yfetch(url);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError(
      `Quote fetch failed for ${exchange}:${bare}`,
      err,
    );
  }

  if (body?.chart?.error) {
    const description =
      body.chart.error.description ?? body.chart.error.code ?? "unknown";
    throw new MarketDataError(
      `Yahoo returned no quote for ${exchange}:${bare}: ${description}`,
    );
  }

  const result = body?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) {
    throw new MarketDataError(
      `Yahoo response had no chart.result[0].meta for ${exchange}:${bare}`,
    );
  }

  const lastPrice = Number(meta.regularMarketPrice);
  const previousClose = Number(
    meta.chartPreviousClose ?? meta.previousClose ?? NaN,
  );
  if (!Number.isFinite(lastPrice) || !Number.isFinite(previousClose)) {
    throw new MarketDataError(
      `Yahoo response missing price fields for ${exchange}:${bare}`,
    );
  }
  const change = lastPrice - previousClose;
  const changePct = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  // `meta` doesn't carry today's open; pull it from the indicators series if
  // present (last entry of the open[] array is the most recent bar).
  const openSeries: unknown[] = result?.indicators?.quote?.[0]?.open ?? [];
  const lastOpen =
    openSeries.length > 0 ? openSeries[openSeries.length - 1] : null;

  return {
    symbol: bare,
    exchange,
    name: meta.longName ?? meta.shortName ?? null,
    lastPrice,
    previousClose,
    open: numOrNull(lastOpen),
    dayHigh: numOrNull(meta.regularMarketDayHigh),
    dayLow: numOrNull(meta.regularMarketDayLow),
    change,
    changePct,
    volume: numOrNull(meta.regularMarketVolume),
    asOf: meta.regularMarketTime
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Fetch daily OHLC candles for the given range. Same chart endpoint as the
 * quote fetcher, but here we consume the indicators arrays (timestamp +
 * open/high/low/close/volume) instead of the meta summary.
 */
export async function fetchHistoricalYahoo(
  symbol: string,
  exchange: Exchange,
  range: Range,
): Promise<HistoricalCandle[]> {
  const bare = normalizeSymbol(symbol);
  if (!bare) {
    throw new MarketDataError(`Empty symbol for ${exchange}`);
  }
  const suffixed = `${bare}${yahooSuffix(exchange)}`;
  const url =
    `${CHART_URL}/${encodeURIComponent(suffixed)}` +
    `?interval=1d&range=${yahooRangeParam(range)}`;

  let body: any;
  try {
    body = await yfetch(url);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError(
      `Historical fetch failed for ${exchange}:${bare}`,
      err,
    );
  }

  if (body?.chart?.error) {
    const description =
      body.chart.error.description ?? body.chart.error.code ?? "unknown";
    throw new MarketDataError(
      `Yahoo returned no historical data for ${exchange}:${bare}: ${description}`,
    );
  }

  const result = body?.chart?.result?.[0];
  const timestamps: unknown[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0] ?? {};
  const opens: unknown[] = quote.open ?? [];
  const highs: unknown[] = quote.high ?? [];
  const lows: unknown[] = quote.low ?? [];
  const closes: unknown[] = quote.close ?? [];
  const volumes: unknown[] = quote.volume ?? [];

  const candles: HistoricalCandle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = Number(timestamps[i]);
    const close = numOrNull(closes[i]);
    // Yahoo sometimes emits a candle for the in-progress trading day where
    // close is null until market closes — skip those, but accept rows where
    // some non-essential fields (open/high/low/volume) are missing.
    if (!Number.isFinite(ts) || close == null) continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    candles.push({
      date,
      open: numOrNull(opens[i]) ?? close,
      high: numOrNull(highs[i]) ?? close,
      low: numOrNull(lows[i]) ?? close,
      close,
      volume: numOrNull(volumes[i]) ?? 0,
    });
  }
  // Yahoo returns chronological order, but dedupe defensively in case of a
  // server-side retry artifact.
  candles.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return candles;
}

export interface SparkQuote {
  symbol: string;
  exchange: Exchange;
  lastPrice: number;
  previousClose: number;
  change: number;
  changePct: number;
}

/**
 * Bulk-fetch lightweight quote snapshots for many symbols. Yahoo's
 * `/v8/finance/spark` endpoint returns one entry per symbol keyed by suffixed
 * ticker, each carrying `chartPreviousClose` and a `close[]` series — we
 * collapse the series to its last finite value as "current".
 *
 * Pass bare tickers; the function adds the right `.NS`/`.BO` suffix per the
 * `exchange` argument and strips it back off in the response. Requests are
 * chunked into batches of 20 because the spark endpoint rejects anything
 * larger with `Number of symbols needs to be less than or equal to 20`.
 */
const SPARK_BATCH_SIZE = 20;

export async function fetchSparkYahoo(
  symbols: string[],
  exchange: Exchange,
): Promise<SparkQuote[]> {
  const bareSymbols = symbols
    .map((s) => normalizeSymbol(s))
    .filter((s) => s.length > 0);
  if (bareSymbols.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < bareSymbols.length; i += SPARK_BATCH_SIZE) {
    batches.push(bareSymbols.slice(i, i + SPARK_BATCH_SIZE));
  }
  const results = await Promise.all(
    batches.map((batch) => fetchSparkBatch(batch, exchange)),
  );
  return results.flat();
}

async function fetchSparkBatch(
  bareSymbols: string[],
  exchange: Exchange,
): Promise<SparkQuote[]> {
  const suffix = yahooSuffix(exchange);
  const suffixed = bareSymbols.map((s) => `${s}${suffix}`);
  return sparkRequest(bareSymbols, suffixed);
}

/**
 * Spark variant for symbols Yahoo already keys natively (Indian indices like
 * "^NSEI", "^BSESN" etc.) — we pass them straight through without any
 * .NS/.BO suffix that the spark batch path would otherwise add.
 */
export async function fetchSparkYahooRaw(
  yahooSymbols: string[],
): Promise<SparkQuote[]> {
  const cleaned = yahooSymbols.filter((s) => typeof s === "string" && s.length > 0);
  if (cleaned.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < cleaned.length; i += SPARK_BATCH_SIZE) {
    batches.push(cleaned.slice(i, i + SPARK_BATCH_SIZE));
  }
  const results = await Promise.all(
    batches.map((batch) => sparkRequest(batch, batch)),
  );
  return results.flat();
}

async function sparkRequest(
  bareSymbols: string[],
  suffixed: string[],
): Promise<SparkQuote[]> {
  const url =
    `${SPARK_URL}?symbols=${encodeURIComponent(suffixed.join(","))}` +
    "&interval=1d&range=1d";

  let body: Record<string, any>;
  try {
    body = await yfetch(url);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError("Spark fetch failed", err);
  }

  if (!body || typeof body !== "object") return [];

  const out: SparkQuote[] = [];
  for (let i = 0; i < bareSymbols.length; i++) {
    const bare = bareSymbols[i]!;
    const key = suffixed[i]!;
    const entry = body[key];
    if (!entry || typeof entry !== "object") continue;
    const prev = Number(entry.chartPreviousClose);
    const closes: unknown[] = Array.isArray(entry.close) ? entry.close : [];
    let lastPrice: number | null = null;
    for (let j = closes.length - 1; j >= 0; j--) {
      const v = numOrNull(closes[j]);
      if (v != null) {
        lastPrice = v;
        break;
      }
    }
    if (lastPrice == null || !Number.isFinite(prev)) continue;
    const change = lastPrice - prev;
    const changePct = prev !== 0 ? (change / prev) * 100 : 0;
    // Raw-symbol callers see exchange "NSE" by convention (indices live there
    // logically); stock callers pass through their own exchange via the typed
    // wrapper. The field is informational for downstream display only.
    out.push({
      symbol: bare,
      exchange: "NSE",
      lastPrice,
      previousClose: prev,
      change,
      changePct,
    });
  }
  return out;
}

/**
 * Fetch daily OHLC candles for a fully-qualified Yahoo symbol (e.g. "^NSEI").
 * Same wire shape as fetchHistoricalYahoo but skips suffix mangling.
 */
export async function fetchHistoricalRawYahoo(
  yahooSymbol: string,
  range: Range,
): Promise<HistoricalCandle[]> {
  if (!yahooSymbol) {
    throw new MarketDataError("Empty Yahoo symbol");
  }
  const url =
    `${CHART_URL}/${encodeURIComponent(yahooSymbol)}` +
    `?interval=1d&range=${yahooRangeParam(range)}`;

  let body: any;
  try {
    body = await yfetch(url);
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    throw new MarketDataError(`Historical fetch failed for ${yahooSymbol}`, err);
  }

  if (body?.chart?.error) {
    const description =
      body.chart.error.description ?? body.chart.error.code ?? "unknown";
    throw new MarketDataError(
      `Yahoo returned no historical data for ${yahooSymbol}: ${description}`,
    );
  }

  const result = body?.chart?.result?.[0];
  const timestamps: unknown[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0] ?? {};
  const opens: unknown[] = quote.open ?? [];
  const highs: unknown[] = quote.high ?? [];
  const lows: unknown[] = quote.low ?? [];
  const closes: unknown[] = quote.close ?? [];
  const volumes: unknown[] = quote.volume ?? [];

  const candles: HistoricalCandle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = Number(timestamps[i]);
    const close = numOrNull(closes[i]);
    if (!Number.isFinite(ts) || close == null) continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    candles.push({
      date,
      open: numOrNull(opens[i]) ?? close,
      high: numOrNull(highs[i]) ?? close,
      low: numOrNull(lows[i]) ?? close,
      close,
      volume: numOrNull(volumes[i]) ?? 0,
    });
  }
  candles.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return candles;
}
