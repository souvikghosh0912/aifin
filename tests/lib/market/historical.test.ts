import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricalCandle } from "@/lib/market/types";

async function loadHistorical(opts?: {
  upstream?: (symbol: string, from: Date, to: Date) => Promise<unknown[]>;
  dbRow?: { payload: HistoricalCandle[]; fetched_at: string } | null;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));

  const upstream =
    opts?.upstream ??
    (async () => [
      {
        CH_TIMESTAMP: "2026-04-01",
        CH_OPENING_PRICE: 100,
        CH_TRADE_HIGH_PRICE: 105,
        CH_TRADE_LOW_PRICE: 99,
        CH_CLOSING_PRICE: 104,
        CH_TOT_TRADED_QTY: 1000,
      },
    ]);

  vi.doMock("nse-bse-api", () => ({
    NSE: class {
      async fetchEquityHistoricalData(p: {
        symbol: string;
        from_date: Date;
        to_date: Date;
      }) {
        return upstream(p.symbol, p.from_date, p.to_date);
      }
    },
    BSE: class {},
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

  it("returns BSE as empty (no upstream available)", async () => {
    const upstream = vi.fn(async () => [
      { CH_TIMESTAMP: "2026-04-01", CH_CLOSING_PRICE: 100 },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    const out = await getHistorical("RELIANCE", "BSE", "3M");
    expect(out).toEqual([]);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("calls upstream once and sorts ascending by date", async () => {
    const upstream = vi.fn(async () => [
      {
        CH_TIMESTAMP: "2026-04-03",
        CH_OPENING_PRICE: 102,
        CH_TRADE_HIGH_PRICE: 106,
        CH_TRADE_LOW_PRICE: 100,
        CH_CLOSING_PRICE: 105,
        CH_TOT_TRADED_QTY: 1100,
      },
      {
        CH_TIMESTAMP: "2026-04-01",
        CH_OPENING_PRICE: 100,
        CH_TRADE_HIGH_PRICE: 105,
        CH_TRADE_LOW_PRICE: 99,
        CH_CLOSING_PRICE: 104,
        CH_TOT_TRADED_QTY: 1000,
      },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    const out = await getHistorical("RELIANCE", "NSE", "1M");
    expect(out.map((c) => c.date)).toEqual(["2026-04-01", "2026-04-03"]);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("serves a warm memory hit without calling upstream", async () => {
    const upstream = vi.fn(async () => [
      {
        CH_TIMESTAMP: "2026-04-01",
        CH_CLOSING_PRICE: 100,
        CH_OPENING_PRICE: 100,
        CH_TRADE_HIGH_PRICE: 100,
        CH_TRADE_LOW_PRICE: 100,
        CH_TOT_TRADED_QTY: 0,
      },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    await getHistorical("TCS", "NSE", "3M");
    await getHistorical("TCS", "NSE", "3M");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("differentiates by range key", async () => {
    const upstream = vi.fn(async () => [
      {
        CH_TIMESTAMP: "2026-04-01",
        CH_CLOSING_PRICE: 100,
        CH_OPENING_PRICE: 100,
        CH_TRADE_HIGH_PRICE: 100,
        CH_TRADE_LOW_PRICE: 100,
        CH_TOT_TRADED_QTY: 0,
      },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    await getHistorical("INFY", "NSE", "1M");
    await getHistorical("INFY", "NSE", "3M");
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("skips rows missing a closing price", async () => {
    const upstream = vi.fn(async () => [
      {
        CH_TIMESTAMP: "2026-04-01",
        CH_CLOSING_PRICE: 100,
        CH_OPENING_PRICE: 100,
        CH_TRADE_HIGH_PRICE: 100,
        CH_TRADE_LOW_PRICE: 100,
        CH_TOT_TRADED_QTY: 0,
      },
      { CH_TIMESTAMP: "2026-04-02", CH_CLOSING_PRICE: null },
    ]);
    const { getHistorical } = await loadHistorical({ upstream });
    const out = await getHistorical("WIPRO", "NSE", "1M");
    expect(out).toHaveLength(1);
  });
});
