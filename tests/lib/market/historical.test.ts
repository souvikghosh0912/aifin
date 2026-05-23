import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricalCandle } from "@/lib/market/types";

async function loadHistorical(opts?: {
  fetcher?: (symbol: string, exchange: string, range: string) => Promise<HistoricalCandle[]>;
  dbRow?: { payload: HistoricalCandle[]; fetched_at: string } | null;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));

  const defaultFetcher = async (): Promise<HistoricalCandle[]> => [
    { date: "2026-04-01", open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  ];

  const fetcher = opts?.fetcher ?? defaultFetcher;

  vi.doMock("@/lib/market/yahoo", () => ({
    fetchHistoricalYahoo: (symbol: string, exchange: string, range: string) =>
      fetcher(symbol, exchange, range),
  }));

  const dbRow = opts?.dbRow ?? null;
  vi.doMock("@/lib/supabase/server", () => ({
    createServiceClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: dbRow, error: null }),
              }),
            }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
    }),
  }));

  return await import("@/lib/market/historical");
}

describe("rangeToDays", () => {
  it("maps each Range to the right day window", async () => {
    const { rangeToDays } = await loadHistorical();
    expect(rangeToDays("1M")).toBe(30);
    expect(rangeToDays("3M")).toBe(90);
    expect(rangeToDays("6M")).toBe(180);
    expect(rangeToDays("1Y")).toBe(365);
  });
});

describe("getHistorical", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fetches BSE history from upstream (Yahoo supports .BO symbols)", async () => {
    const fetcher = vi.fn(async () => [
      { date: "2026-04-01", open: 100, high: 105, low: 99, close: 104, volume: 1000 },
    ]);
    const { getHistorical } = await loadHistorical({ fetcher });
    const out = await getHistorical("RELIANCE", "BSE", "3M");
    expect(out).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("RELIANCE", "BSE", "3M");
  });

  it("calls upstream once and returns its candles", async () => {
    const fetcher = vi.fn(async () => [
      { date: "2026-04-01", open: 100, high: 105, low: 99, close: 104, volume: 1000 },
      { date: "2026-04-03", open: 102, high: 106, low: 100, close: 105, volume: 1100 },
    ]);
    const { getHistorical } = await loadHistorical({ fetcher });
    const out = await getHistorical("RELIANCE", "NSE", "1M");
    expect(out.map((c) => c.date)).toEqual(["2026-04-01", "2026-04-03"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves a warm memory hit without calling upstream", async () => {
    const fetcher = vi.fn(async () => [
      { date: "2026-04-01", open: 100, high: 100, low: 100, close: 100, volume: 0 },
    ]);
    const { getHistorical } = await loadHistorical({ fetcher });
    await getHistorical("TCS", "NSE", "3M");
    await getHistorical("TCS", "NSE", "3M");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("differentiates by range key", async () => {
    const fetcher = vi.fn(async () => [
      { date: "2026-04-01", open: 100, high: 100, low: 100, close: 100, volume: 0 },
    ]);
    const { getHistorical } = await loadHistorical({ fetcher });
    await getHistorical("INFY", "NSE", "1M");
    await getHistorical("INFY", "NSE", "3M");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
