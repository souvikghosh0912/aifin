import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarketDataError, type Quote } from "@/lib/market/types";

const getQuote = vi.fn();

vi.mock("@/lib/market/nse", () => ({
  getQuote: (s: string, e: "NSE" | "BSE") => getQuote(s, e),
}));

async function getRoute() {
  return (await import("@/app/api/quote/[symbol]/route")).GET;
}

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "RELIANCE",
    exchange: "NSE",
    name: "Reliance",
    lastPrice: 100,
    previousClose: 99,
    open: 99,
    dayHigh: 101,
    dayLow: 98,
    change: 1,
    changePct: 1.01,
    volume: 100,
    asOf: new Date().toISOString(),
    ...overrides,
  };
}

describe("GET /api/quote/[symbol]", () => {
  beforeEach(() => {
    getQuote.mockReset();
  });

  it("returns the quote for a valid symbol, defaulting to NSE", async () => {
    getQuote.mockResolvedValue(quote({ lastPrice: 123 }));
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/quote/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=15");
    const body = await res.json();
    expect(body.lastPrice).toBe(123);
    expect(getQuote).toHaveBeenCalledWith("RELIANCE", "NSE");
  });

  it("passes through the exchange query parameter when BSE", async () => {
    getQuote.mockResolvedValue(quote({ exchange: "BSE" }));
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/quote/RELIANCE?exchange=BSE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(200);
    expect(getQuote).toHaveBeenCalledWith("RELIANCE", "BSE");
  });

  it("returns 400 for an invalid symbol", async () => {
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/quote/x")),
      { params: Promise.resolve({ symbol: "" }) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_symbol" });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it("surfaces MarketDataError messages as 502", async () => {
    getQuote.mockRejectedValue(new MarketDataError("upstream_down"));
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/quote/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_down" });
  });

  it("returns a generic 502 for other errors", async () => {
    getQuote.mockRejectedValue(new Error("boom"));
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/quote/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "fetch_failed" });
  });
});
