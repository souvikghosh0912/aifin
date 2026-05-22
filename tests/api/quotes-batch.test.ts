import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getQuotes = vi.fn();

vi.mock("@/lib/market/nse", () => ({
  getQuotes: (items: unknown) => getQuotes(items),
}));

async function getRoute() {
  return (await import("@/app/api/quotes/batch/route")).POST;
}

function postReq(body: unknown, opts: { raw?: string } = {}) {
  return new NextRequest(new URL("http://localhost/api/quotes/batch"), {
    method: "POST",
    body: opts.raw ?? JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/quotes/batch", () => {
  beforeEach(() => {
    getQuotes.mockReset();
  });

  it("returns quotes for a valid body", async () => {
    getQuotes.mockResolvedValue({
      "NSE:RELIANCE": { symbol: "RELIANCE", lastPrice: 100 },
    });
    const POST = await getRoute();
    const res = await POST(
      postReq({ items: [{ symbol: "RELIANCE", exchange: "NSE" }] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quotes["NSE:RELIANCE"].lastPrice).toBe(100);
  });

  it("returns 400 for malformed JSON", async () => {
    const POST = await getRoute();
    const res = await POST(postReq(null, { raw: "{not json" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("returns 400 when items is empty", async () => {
    const POST = await getRoute();
    const res = await POST(postReq({ items: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("returns 400 when items exceeds the 50-item cap", async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      symbol: `S${i}`,
      exchange: "NSE" as const,
    }));
    const POST = await getRoute();
    const res = await POST(postReq({ items }));
    expect(res.status).toBe(400);
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown exchange", async () => {
    const POST = await getRoute();
    const res = await POST(
      postReq({ items: [{ symbol: "FOO", exchange: "NASDAQ" }] }),
    );
    expect(res.status).toBe(400);
    expect(getQuotes).not.toHaveBeenCalled();
  });
});
