import { beforeEach, describe, expect, it, vi } from "vitest";

const getQuote = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/market/nse", () => ({
  getQuote: (s: string, e: "NSE" | "BSE") => getQuote(s, e),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: fromMock,
  }),
}));

async function getRoute() {
  return (await import("@/app/api/health/route")).GET;
}

function setDbOk() {
  fromMock.mockReturnValue({
    select: () => ({
      limit: async () => ({ data: [], error: null }),
    }),
  });
}

function setDbError(message: string) {
  fromMock.mockReturnValue({
    select: () => ({
      limit: async () => ({ data: null, error: { message } }),
    }),
  });
}

describe("GET /api/health", () => {
  beforeEach(() => {
    getQuote.mockReset();
    fromMock.mockReset();
  });

  it("returns 200 with ok=true when db and upstream both succeed", async () => {
    setDbOk();
    getQuote.mockResolvedValue({ lastPrice: 100 });

    const GET = await getRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.upstream.ok).toBe(true);
  });

  it("returns 503 when the db check fails", async () => {
    setDbError("connection refused");
    getQuote.mockResolvedValue({ lastPrice: 100 });

    const GET = await getRoute();
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.db.message).toBe("connection refused");
  });

  it("returns 503 when the upstream check throws", async () => {
    setDbOk();
    getQuote.mockRejectedValue(new Error("timeout"));

    const GET = await getRoute();
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.checks.upstream.ok).toBe(false);
    expect(body.checks.upstream.message).toBe("timeout");
  });
});
