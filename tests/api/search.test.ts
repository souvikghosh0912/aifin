import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchSymbols = vi.fn();

vi.mock("@/lib/market/nse", () => ({
  searchSymbols: (q: string) => searchSymbols(q),
}));

async function getRoute() {
  return (await import("@/app/api/search/route")).GET;
}

function req(url: string) {
  return new NextRequest(new URL(url));
}

describe("GET /api/search", () => {
  beforeEach(() => {
    searchSymbols.mockReset();
  });

  it("returns an empty hits array when q is missing", async () => {
    const GET = await getRoute();
    const res = await GET(req("http://localhost/api/search"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hits: [] });
    expect(searchSymbols).not.toHaveBeenCalled();
  });

  it("returns 400 when q is longer than 40 chars", async () => {
    const GET = await getRoute();
    const res = await GET(
      req("http://localhost/api/search?q=" + "a".repeat(41)),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "query_too_long" });
    expect(searchSymbols).not.toHaveBeenCalled();
  });

  it("forwards the query to searchSymbols and returns the hits", async () => {
    searchSymbols.mockResolvedValue([
      { symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries" },
    ]);
    const GET = await getRoute();
    const res = await GET(req("http://localhost/api/search?q=reli"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hits).toHaveLength(1);
    expect(body.hits[0].symbol).toBe("RELIANCE");
    expect(searchSymbols).toHaveBeenCalledWith("reli");
  });

  it("trims surrounding whitespace from q", async () => {
    searchSymbols.mockResolvedValue([]);
    const GET = await getRoute();
    await GET(req("http://localhost/api/search?q=%20%20tcs%20%20"));
    expect(searchSymbols).toHaveBeenCalledWith("tcs");
  });
});
