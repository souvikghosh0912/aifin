import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Quote } from "@/lib/market/types";

// Module-level state in cache.ts means we must reset between tests.
async function loadCache() {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createServiceClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
    }),
  }));
  return await import("@/lib/market/cache");
}

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "RELIANCE",
    exchange: "NSE",
    name: "Reliance",
    lastPrice: 100,
    previousClose: 99,
    open: 99.5,
    dayHigh: 101,
    dayLow: 98,
    change: 1,
    changePct: 1.01,
    volume: 1000,
    asOf: new Date().toISOString(),
    ...overrides,
  };
}

describe("getCachedQuote", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls the fetcher on a cold cache and returns its value", async () => {
    const { getCachedQuote } = await loadCache();
    const fetcher = vi.fn().mockResolvedValue(quote({ lastPrice: 123 }));

    const out = await getCachedQuote("RELIANCE", "NSE", fetcher);

    expect(out.lastPrice).toBe(123);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves a warm hit from memory without calling the fetcher again", async () => {
    const { getCachedQuote } = await loadCache();
    const fetcher = vi.fn().mockResolvedValue(quote({ lastPrice: 200 }));

    await getCachedQuote("TCS", "NSE", fetcher);
    await getCachedQuote("TCS", "NSE", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent requests for the same key into a single fetch", async () => {
    const { getCachedQuote } = await loadCache();
    let resolveFetch: ((v: Quote) => void) | null = null;
    const fetcher = vi.fn(
      () =>
        new Promise<Quote>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const p1 = getCachedQuote("INFY", "NSE", fetcher);
    const p2 = getCachedQuote("INFY", "NSE", fetcher);

    // getCachedQuote awaits an internal DB lookup before calling the fetcher;
    // flush enough microtasks for that to settle.
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetch!(quote({ symbol: "INFY", lastPrice: 1500 }));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.lastPrice).toBe(1500);
    expect(r2.lastPrice).toBe(1500);
  });

  it("differentiates by exchange", async () => {
    const { getCachedQuote } = await loadCache();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(quote({ exchange: "NSE", lastPrice: 100 }))
      .mockResolvedValueOnce(quote({ exchange: "BSE", lastPrice: 200 }));

    const nse = await getCachedQuote("WIPRO", "NSE", fetcher);
    const bse = await getCachedQuote("WIPRO", "BSE", fetcher);

    expect(nse.lastPrice).toBe(100);
    expect(bse.lastPrice).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
