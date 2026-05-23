import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SparkQuote } from "@/lib/market/yahoo";

async function loadTopGainers(opts?: {
  spark?: () => Promise<SparkQuote[]> | SparkQuote[];
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/yahoo", () => ({
    fetchSparkYahoo: async () =>
      opts?.spark ? await opts.spark() : ([] as SparkQuote[]),
  }));
  return await import("@/lib/market/top-gainers");
}

describe("getTopGainers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the top 20 by changePct desc, normalizing fields", async () => {
    const rows: SparkQuote[] = Array.from({ length: 30 }, (_, i) => ({
      symbol: `SYM${i}`,
      exchange: "NSE",
      lastPrice: 100 + i,
      previousClose: 100,
      change: i,
      changePct: i,
    }));
    const { getTopGainers } = await loadTopGainers({
      spark: async () => rows,
    });
    const out = await getTopGainers();
    expect(out).toHaveLength(20);
    expect(out[0]!.symbol).toBe("SYM29");
    expect(out[0]!.changePct).toBe(29);
    expect(out[0]!.change).toBe(29);
    expect(out[0]!.lastPrice).toBe(129);
  });

  it("returns [] on upstream throw", async () => {
    const { getTopGainers } = await loadTopGainers({
      spark: () => {
        throw new Error("boom");
      },
    });
    expect(await getTopGainers()).toEqual([]);
  });

  it("returns [] when upstream returns an empty list", async () => {
    const { getTopGainers } = await loadTopGainers({
      spark: async () => [],
    });
    expect(await getTopGainers()).toEqual([]);
  });
});
