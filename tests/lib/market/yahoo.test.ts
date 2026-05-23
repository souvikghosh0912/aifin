import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchHistoricalYahoo,
  fetchQuoteYahoo,
  searchSymbolsYahoo,
} from "@/lib/market/yahoo";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as unknown as Response;
}

describe("searchSymbolsYahoo", () => {
  it("returns NSE+BSE hits, stripping .NS/.BO suffixes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        quotes: [
          { symbol: "RELIANCE.NS", longname: "Reliance Industries Limited" },
          { symbol: "ITC.BO", shortname: "ITC LTD." },
          { symbol: "AAPL", longname: "Apple Inc." }, // not Indian — should be skipped
          { symbol: "TCS.NS", longname: "Tata Consultancy Services" },
        ],
      }),
    );

    const hits = await searchSymbolsYahoo("anything");

    expect(hits).toEqual([
      { symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries Limited" },
      { symbol: "ITC", exchange: "BSE", name: "ITC LTD." },
      { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services" },
    ]);
  });

  it("deduplicates by exchange+symbol", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        quotes: [
          { symbol: "ITC.NS", longname: "ITC Limited" },
          { symbol: "ITC.NS", longname: "ITC Limited" },
          { symbol: "ITC.BO", longname: "ITC Limited" },
        ],
      }),
    );

    const hits = await searchSymbolsYahoo("itc");

    expect(hits).toHaveLength(2);
    expect(hits.map((h) => `${h.exchange}:${h.symbol}`).sort()).toEqual([
      "BSE:ITC",
      "NSE:ITC",
    ]);
  });

  it("returns [] for empty or whitespace query without hitting the network", async () => {
    expect(await searchSymbolsYahoo("")).toEqual([]);
    expect(await searchSymbolsYahoo("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws MarketDataError on non-2xx upstream response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 503 }));
    await expect(searchSymbolsYahoo("itc")).rejects.toThrow(/503/);
  });
});

describe("fetchQuoteYahoo", () => {
  function chartResponse(meta: Record<string, unknown>, openSeries?: number[]) {
    return {
      chart: {
        result: [
          {
            meta,
            indicators: openSeries
              ? { quote: [{ open: openSeries }] }
              : undefined,
          },
        ],
      },
    };
  }

  it("maps Yahoo chart meta into the normalized Quote shape", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        chartResponse(
          {
            symbol: "ITC.NS",
            longName: "ITC Limited",
            shortName: "ITC LTD",
            regularMarketPrice: 301.7,
            chartPreviousClose: 310.15,
            regularMarketDayHigh: 307,
            regularMarketDayLow: 301,
            regularMarketVolume: 30742344,
            regularMarketTime: 1779444000,
          },
          [300.5],
        ),
      ),
    );

    const q = await fetchQuoteYahoo("ITC", "NSE");

    expect(q.symbol).toBe("ITC");
    expect(q.exchange).toBe("NSE");
    expect(q.name).toBe("ITC Limited");
    expect(q.lastPrice).toBeCloseTo(301.7, 5);
    expect(q.previousClose).toBeCloseTo(310.15, 5);
    expect(q.change).toBeCloseTo(-8.45, 5);
    expect(q.changePct).toBeCloseTo((-8.45 / 310.15) * 100, 5);
    expect(q.open).toBe(300.5);
    expect(q.dayHigh).toBe(307);
    expect(q.dayLow).toBe(301);
    expect(q.volume).toBe(30742344);
    expect(q.asOf).toBe(new Date(1779444000 * 1000).toISOString());
  });

  it("requests the .BO suffix for BSE exchange", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        chartResponse({
          regularMarketPrice: 100,
          chartPreviousClose: 99,
        }),
      ),
    );

    await fetchQuoteYahoo("ITC", "BSE");

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/ITC.BO");
    expect(url).not.toContain("/ITC.NS");
  });

  it("throws MarketDataError when Yahoo returns chart.error (unknown symbol)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        chart: {
          result: null,
          error: { code: "Not Found", description: "No data found" },
        },
      }),
    );

    await expect(fetchQuoteYahoo("FAKE", "NSE")).rejects.toThrow(
      /No data found/,
    );
  });

  it("throws MarketDataError when price fields are missing", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(chartResponse({ symbol: "X.NS" })),
    );

    await expect(fetchQuoteYahoo("X", "NSE")).rejects.toThrow(
      /missing price fields/,
    );
  });

  it("throws MarketDataError on non-2xx upstream response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 500 }));
    await expect(fetchQuoteYahoo("ITC", "NSE")).rejects.toThrow(/500/);
  });
});

describe("fetchHistoricalYahoo", () => {
  function chartHistoryResponse(opts: {
    timestamps: number[];
    open?: (number | null)[];
    high?: (number | null)[];
    low?: (number | null)[];
    close: (number | null)[];
    volume?: (number | null)[];
  }) {
    return {
      chart: {
        result: [
          {
            timestamp: opts.timestamps,
            indicators: {
              quote: [
                {
                  open: opts.open,
                  high: opts.high,
                  low: opts.low,
                  close: opts.close,
                  volume: opts.volume,
                },
              ],
            },
          },
        ],
      },
    };
  }

  it("maps Yahoo OHLC arrays into HistoricalCandle[] sorted ascending", async () => {
    // Two trading days, 2026-04-01 and 2026-04-02 (UTC midnight)
    const t1 = Math.floor(new Date("2026-04-01T00:00:00Z").getTime() / 1000);
    const t2 = Math.floor(new Date("2026-04-02T00:00:00Z").getTime() / 1000);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        chartHistoryResponse({
          timestamps: [t1, t2],
          open: [100, 102],
          high: [105, 106],
          low: [99, 100],
          close: [104, 105],
          volume: [1000, 1100],
        }),
      ),
    );

    const out = await fetchHistoricalYahoo("RELIANCE", "NSE", "1M");

    expect(out).toEqual([
      { date: "2026-04-01", open: 100, high: 105, low: 99, close: 104, volume: 1000 },
      { date: "2026-04-02", open: 102, high: 106, low: 100, close: 105, volume: 1100 },
    ]);
  });

  it("skips candles with no close (in-progress trading day)", async () => {
    const t1 = Math.floor(new Date("2026-04-01T00:00:00Z").getTime() / 1000);
    const t2 = Math.floor(new Date("2026-04-02T00:00:00Z").getTime() / 1000);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        chartHistoryResponse({
          timestamps: [t1, t2],
          close: [100, null],
        }),
      ),
    );

    const out = await fetchHistoricalYahoo("X", "NSE", "1M");

    expect(out).toHaveLength(1);
    expect(out[0]!.date).toBe("2026-04-01");
  });

  it("falls back to close for missing OHLC fields", async () => {
    const t1 = Math.floor(new Date("2026-04-01T00:00:00Z").getTime() / 1000);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        chartHistoryResponse({
          timestamps: [t1],
          close: [100],
          // no open/high/low/volume
        }),
      ),
    );

    const out = await fetchHistoricalYahoo("X", "NSE", "1M");

    expect(out[0]!.open).toBe(100);
    expect(out[0]!.high).toBe(100);
    expect(out[0]!.low).toBe(100);
    expect(out[0]!.volume).toBe(0);
  });

  it("maps Range to the right yahoo range param", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(chartHistoryResponse({ timestamps: [], close: [] })),
    );
    await fetchHistoricalYahoo("X", "NSE", "3M");
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("range=3mo");
    expect(url).toContain("/X.NS");
  });

  it("throws MarketDataError when Yahoo returns chart.error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        chart: {
          result: null,
          error: { code: "Not Found", description: "Symbol not found" },
        },
      }),
    );

    await expect(fetchHistoricalYahoo("FAKE", "NSE", "1M")).rejects.toThrow(
      /Symbol not found/,
    );
  });
});
