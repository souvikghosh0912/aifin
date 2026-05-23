import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadMeta(opts?: {
  upstream?: () => Promise<unknown> | unknown;
}) {
  vi.resetModules();
  vi.doMock("@/lib/market/rate-limit", () => ({
    nseBucket: { acquire: async () => {} },
  }));
  vi.doMock("nse-bse-api", () => ({
    NSE: class {
      async getEquityMetaInfo(_s: string) {
        return opts?.upstream ? opts.upstream() : null;
      }
    },
    BSE: class {},
  }));
  return await import("@/lib/market/meta");
}

describe("getMetaInfo", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("normalizes the NSE payload", async () => {
    const { getMetaInfo } = await loadMeta({
      upstream: async () => ({
        info: { companyName: "Reliance Industries" },
        industryInfo: { industry: "Refineries" },
        securityInfo: { issuedSize: 6_000_000_000, faceValue: 10 },
        priceInfo: { lastPrice: 2400 },
      }),
    });
    const out = await getMetaInfo("RELIANCE", "NSE");
    expect(out.name).toBe("Reliance Industries");
    expect(out.industry).toBe("Refineries");
    expect(out.marketCap).toBeGreaterThan(0);
  });

  it("returns null fields when upstream omits them", async () => {
    const { getMetaInfo } = await loadMeta({ upstream: async () => ({}) });
    const out = await getMetaInfo("XYZ", "NSE");
    expect(out).toEqual({
      symbol: "XYZ",
      exchange: "NSE",
      name: null,
      industry: null,
      marketCap: null,
    });
  });

  it("returns an all-null shape for BSE without calling upstream", async () => {
    const upstream = vi.fn(async () => ({ info: { companyName: "foo" } }));
    const { getMetaInfo } = await loadMeta({ upstream });
    const out = await getMetaInfo("RELIANCE", "BSE");
    expect(out).toEqual({
      symbol: "RELIANCE",
      exchange: "BSE",
      name: null,
      industry: null,
      marketCap: null,
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns null fields when upstream throws", async () => {
    const { getMetaInfo } = await loadMeta({
      upstream: () => {
        throw new Error("boom");
      },
    });
    const out = await getMetaInfo("RELIANCE", "NSE");
    expect(out.name).toBeNull();
    expect(out.marketCap).toBeNull();
  });
});
