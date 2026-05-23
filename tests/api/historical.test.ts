import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarketDataError } from "@/lib/market/types";

const getHistorical = vi.fn();

vi.mock("@/lib/market/historical", () => ({
  getHistorical: (s: string, e: "NSE" | "BSE", r: "1M" | "3M" | "6M" | "1Y") =>
    getHistorical(s, e, r),
}));

async function getRoute() {
  return (await import("@/app/api/historical/[symbol]/route")).GET;
}

describe("GET /api/historical/[symbol]", () => {
  beforeEach(() => {
    getHistorical.mockReset();
  });

  it("returns candles for a valid request, defaulting to NSE + 3M", async () => {
    getHistorical.mockResolvedValue([
      {
        date: "2026-04-01",
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
      },
    ]);
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    const body = await res.json();
    expect(body.candles).toHaveLength(1);
    expect(getHistorical).toHaveBeenCalledWith("RELIANCE", "NSE", "3M");
  });

  it("honors range and exchange query params", async () => {
    getHistorical.mockResolvedValue([]);
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(
        new URL(
          "http://localhost/api/historical/TCS?range=1Y&exchange=BSE",
        ),
      ),
      { params: Promise.resolve({ symbol: "TCS" }) },
    );
    expect(res.status).toBe(200);
    expect(getHistorical).toHaveBeenCalledWith("TCS", "BSE", "1Y");
  });

  it("returns 400 for an unknown range", async () => {
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(
        new URL("http://localhost/api/historical/TCS?range=2Y"),
      ),
      { params: Promise.resolve({ symbol: "TCS" }) },
    );
    expect(res.status).toBe(400);
    expect(getHistorical).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty symbol", async () => {
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/_")),
      { params: Promise.resolve({ symbol: "" }) },
    );
    expect(res.status).toBe(400);
  });

  it("surfaces MarketDataError as 502", async () => {
    getHistorical.mockRejectedValue(new MarketDataError("upstream_down"));
    const GET = await getRoute();
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/historical/RELIANCE")),
      { params: Promise.resolve({ symbol: "RELIANCE" }) },
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_down" });
  });
});
