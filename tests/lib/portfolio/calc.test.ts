import { describe, expect, it } from "vitest";

import type { Quote } from "@/lib/market/types";
import {
  computeAllocation,
  computeHoldings,
  computeTotals,
  enrichHoldings,
  xirr,
} from "@/lib/portfolio/calc";
import type { Tables, Views } from "@/types/database";

type Transaction = Tables<"transactions">;
type Holding = Views<"holdings_view">;

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: "tx-" + Math.random(),
    user_id: "u1",
    portfolio_id: "p1",
    symbol: "RELIANCE",
    exchange: "NSE",
    side: "BUY",
    quantity: 10,
    price: 100,
    fees: 0,
    traded_at: "2026-01-01",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function quote(overrides: Partial<Quote>): Quote {
  return {
    symbol: "RELIANCE",
    exchange: "NSE",
    name: "Reliance",
    lastPrice: 110,
    previousClose: 105,
    open: 106,
    dayHigh: 112,
    dayLow: 104,
    change: 5,
    changePct: 4.76,
    volume: 1000,
    asOf: "2026-05-22T10:00:00Z",
    ...overrides,
  };
}

describe("computeHoldings", () => {
  it("aggregates BUY transactions into a single holding with weighted-average cost", () => {
    // 10@100 fees 0  -> grossBuy 1000, qty 10
    // 10@120 fees 10 -> grossBuy 1210, qty 10
    // avg cost = (1000+1210) / 20 = 110.5
    const out = computeHoldings([
      tx({ quantity: 10, price: 100, fees: 0 }),
      tx({ quantity: 10, price: 120, fees: 10 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.quantity).toBe(20);
    expect(out[0]!.avg_cost).toBeCloseTo(110.5, 5);
    expect(out[0]!.invested_value).toBeCloseTo(2210, 5);
    expect(out[0]!.realized_pnl).toBe(0);
  });

  it("computes realized P&L on SELL using buy-side avg cost", () => {
    // BUY 10@100 (avg cost 100), SELL 4@150 fee 0 -> realized = 600 - 4*100 = 200
    const out = computeHoldings([
      tx({ quantity: 10, price: 100 }),
      tx({ side: "SELL", quantity: 4, price: 150, fees: 0 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.quantity).toBe(6);
    expect(out[0]!.avg_cost).toBe(100);
    expect(out[0]!.realized_pnl).toBeCloseTo(200, 5);
  });

  it("drops fully-closed positions (quantity <= 0)", () => {
    const out = computeHoldings([
      tx({ quantity: 10, price: 100 }),
      tx({ side: "SELL", quantity: 10, price: 110 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("keeps holdings on different exchanges separate", () => {
    const out = computeHoldings([
      tx({ exchange: "NSE", quantity: 5 }),
      tx({ exchange: "BSE", quantity: 5 }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("returns an empty array for no transactions", () => {
    expect(computeHoldings([])).toEqual([]);
  });
});

describe("enrichHoldings", () => {
  const holding: Holding = {
    user_id: "u1",
    portfolio_id: "p1",
    symbol: "RELIANCE",
    exchange: "NSE",
    quantity: 10,
    avg_cost: 100,
    invested_value: 1000,
    realized_pnl: 0,
  };

  it("computes market value and unrealized P&L when quote is present", () => {
    const out = enrichHoldings([holding], {
      "NSE:RELIANCE": quote({ lastPrice: 120, previousClose: 110 }),
    });
    expect(out[0]!.marketValue).toBe(1200);
    expect(out[0]!.unrealizedPnl).toBe(200);
    expect(out[0]!.unrealizedPnlPct).toBeCloseTo(20, 5);
    expect(out[0]!.dayChange).toBe(100); // 10 * (120 - 110)
  });

  it("falls back to invested value when quote is missing", () => {
    const out = enrichHoldings([holding], {});
    expect(out[0]!.quote).toBeNull();
    expect(out[0]!.marketValue).toBe(1000);
    expect(out[0]!.unrealizedPnl).toBe(0);
    expect(out[0]!.dayChange).toBe(0);
  });

  it("treats an error payload as a missing quote", () => {
    const out = enrichHoldings([holding], {
      "NSE:RELIANCE": { error: "rate_limited" },
    });
    expect(out[0]!.quote).toBeNull();
    expect(out[0]!.marketValue).toBe(1000);
  });

  it("handles zero invested value without dividing by zero", () => {
    const free: Holding = { ...holding, invested_value: 0, avg_cost: 0 };
    const out = enrichHoldings([free], {
      "NSE:RELIANCE": quote({ lastPrice: 100 }),
    });
    expect(out[0]!.unrealizedPnlPct).toBe(0);
  });
});

describe("computeTotals", () => {
  it("sums invested, market value, and day change across positions", () => {
    const holdings: Holding[] = [
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "A",
        exchange: "NSE",
        quantity: 10,
        avg_cost: 100,
        invested_value: 1000,
        realized_pnl: 50,
      },
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "B",
        exchange: "NSE",
        quantity: 5,
        avg_cost: 200,
        invested_value: 1000,
        realized_pnl: -10,
      },
    ];
    const enriched = enrichHoldings(holdings, {
      "NSE:A": quote({ symbol: "A", lastPrice: 110, previousClose: 105 }),
      "NSE:B": quote({ symbol: "B", lastPrice: 250, previousClose: 240 }),
    });
    const totals = computeTotals(enriched, holdings);

    expect(totals.invested).toBe(2000);
    expect(totals.marketValue).toBe(10 * 110 + 5 * 250); // 2350
    expect(totals.unrealizedPnl).toBe(350);
    expect(totals.unrealizedPnlPct).toBeCloseTo(17.5, 5);
    expect(totals.dayChange).toBe(10 * 5 + 5 * 10); // 100
    expect(totals.realizedPnl).toBe(40);
  });

  it("handles an empty portfolio", () => {
    const totals = computeTotals([], []);
    expect(totals).toEqual({
      invested: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      dayChange: 0,
      dayChangePct: 0,
      realizedPnl: 0,
    });
  });

  // Regression: Postgres `numeric` columns come back from supabase-js as JSON
  // strings, but the generated TS type declares them `number`. Before the fix,
  // `reduce((s, h) => s + h.invested_value, 0)` did string concatenation:
  // 0 + "1000.00" → "01000.00", then "01000.00" + "1000.00" → "01000.001000.00"
  // (two dots → NaN), so Total P/L rendered as "—". Coercion in enrichHoldings
  // and computeTotals should make this a real number.
  it("coerces numeric-string fields from the holdings_view (supabase numeric bug)", () => {
    const holdings = [
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "A",
        exchange: "NSE" as const,
        quantity: "10" as unknown as number,
        avg_cost: "100" as unknown as number,
        invested_value: "1000.00" as unknown as number,
        realized_pnl: "50.00" as unknown as number,
      },
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "B",
        exchange: "NSE" as const,
        quantity: "5" as unknown as number,
        avg_cost: "200" as unknown as number,
        invested_value: "1000.00" as unknown as number,
        realized_pnl: "-10.00" as unknown as number,
      },
    ];
    const enriched = enrichHoldings(holdings, {
      "NSE:A": quote({ symbol: "A", lastPrice: 110, previousClose: 105 }),
      "NSE:B": quote({ symbol: "B", lastPrice: 250, previousClose: 240 }),
    });
    const totals = computeTotals(enriched, holdings);

    expect(Number.isFinite(totals.invested)).toBe(true);
    expect(Number.isFinite(totals.marketValue)).toBe(true);
    expect(Number.isFinite(totals.unrealizedPnl)).toBe(true);
    expect(Number.isFinite(totals.realizedPnl)).toBe(true);
    expect(totals.invested).toBe(2000);
    expect(totals.marketValue).toBe(2350);
    expect(totals.unrealizedPnl).toBe(350);
    expect(totals.realizedPnl).toBe(40);
  });

  it("computes correct totals when quotes are missing and inputs are numeric strings", () => {
    // When the upstream quote API is down, every quote is missing and the
    // null-quote branch falls back to marketValue = invested_value. Total P/L
    // should be exactly 0 — not NaN, not "—".
    const holdings = [
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "A",
        exchange: "NSE" as const,
        quantity: "10" as unknown as number,
        avg_cost: "100" as unknown as number,
        invested_value: "1000.00" as unknown as number,
        realized_pnl: "0" as unknown as number,
      },
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "B",
        exchange: "NSE" as const,
        quantity: "5" as unknown as number,
        avg_cost: "200" as unknown as number,
        invested_value: "1000.00" as unknown as number,
        realized_pnl: "0" as unknown as number,
      },
    ];
    const enriched = enrichHoldings(holdings, {});
    const totals = computeTotals(enriched, holdings);

    expect(totals.invested).toBe(2000);
    expect(totals.marketValue).toBe(2000);
    expect(totals.unrealizedPnl).toBe(0);
  });
});

describe("computeAllocation", () => {
  it("returns slices sorted by value descending and percentages summing to 100", () => {
    const holdings: Holding[] = [
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "SMALL",
        exchange: "NSE",
        quantity: 1,
        avg_cost: 100,
        invested_value: 100,
        realized_pnl: 0,
      },
      {
        user_id: "u",
        portfolio_id: "p",
        symbol: "BIG",
        exchange: "NSE",
        quantity: 10,
        avg_cost: 100,
        invested_value: 1000,
        realized_pnl: 0,
      },
    ];
    const enriched = enrichHoldings(holdings, {
      "NSE:SMALL": quote({ symbol: "SMALL", lastPrice: 100 }),
      "NSE:BIG": quote({ symbol: "BIG", lastPrice: 100 }),
    });
    const alloc = computeAllocation(enriched);

    expect(alloc.map((a) => a.symbol)).toEqual(["BIG", "SMALL"]);
    const sum = alloc.reduce((s, a) => s + a.pct, 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it("returns an empty array when there is no market value", () => {
    expect(computeAllocation([])).toEqual([]);
  });
});

describe("xirr", () => {
  it("returns ~10% for a flat 10%-per-year cashflow", () => {
    // Invest 1000 at t=0, receive 1100 at t=1y -> ~10%
    const r = xirr([
      { amount: -1000, date: new Date("2025-01-01") },
      { amount: 1100, date: new Date("2026-01-01") },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.1, 2);
  });

  it("returns null when cashflows are all positive or all negative", () => {
    expect(
      xirr([
        { amount: -100, date: new Date("2025-01-01") },
        { amount: -100, date: new Date("2026-01-01") },
      ]),
    ).toBeNull();
    expect(
      xirr([
        { amount: 100, date: new Date("2025-01-01") },
        { amount: 100, date: new Date("2026-01-01") },
      ]),
    ).toBeNull();
  });

  it("returns null for fewer than two cashflows", () => {
    expect(
      xirr([{ amount: -100, date: new Date("2025-01-01") }]),
    ).toBeNull();
  });
});
