import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadTopGainers(opts?: {
  upstream?: () => Promise<unknown> | unknown;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));
  vi.doMock("nse-bse-api", () => ({
    NSE: class {
      async listEquityStocksByIndex(_idx: string) {
        return opts?.upstream ? opts.upstream() : { data: [] };
      }
    },
    BSE: class {},
  }));
  return await import("@/lib/market/top-gainers");
}

describe("getTopGainers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the top 20 by pChange desc, normalizing fields", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      symbol: `SYM${i}`,
      meta: { companyName: `Co ${i}` },
      lastPrice: 100 + i,
      pChange: i,
    }));
    const { getTopGainers } = await loadTopGainers({
      upstream: async () => ({ data: rows }),
    });
    const out = await getTopGainers();
    expect(out).toHaveLength(20);
    expect(out[0]!.symbol).toBe("SYM29");
    expect(out[0]!.changePct).toBe(29);
    expect(out[0]!.name).toBe("Co 29");
  });

  it("returns [] on upstream throw", async () => {
    const { getTopGainers } = await loadTopGainers({
      upstream: () => {
        throw new Error("boom");
      },
    });
    expect(await getTopGainers()).toEqual([]);
  });

  it("returns [] when upstream returns a non-array payload", async () => {
    const { getTopGainers } = await loadTopGainers({
      upstream: async () => ({ data: null }),
    });
    expect(await getTopGainers()).toEqual([]);
  });
});
