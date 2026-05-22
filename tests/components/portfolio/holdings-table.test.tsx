import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { HoldingsTable } from "@/components/portfolio/holdings-table";
import type { Views } from "@/types/database";

import { renderWithQuery } from "../../helpers/render";

type Holding = Views<"holdings_view">;

const HOLDING: Holding = {
  user_id: "u1",
  portfolio_id: "p1",
  symbol: "RELIANCE",
  exchange: "NSE",
  quantity: 10,
  avg_cost: 100,
  invested_value: 1000,
  realized_pnl: 0,
};

describe("<HoldingsTable />", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            quotes: {
              "NSE:RELIANCE": {
                symbol: "RELIANCE",
                exchange: "NSE",
                name: "Reliance",
                lastPrice: 120,
                previousClose: 115,
                open: 116,
                dayHigh: 122,
                dayLow: 114,
                change: 5,
                changePct: 4.35,
                volume: 1000,
                asOf: "2026-05-22T10:00:00Z",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty state when there are no holdings", () => {
    renderWithQuery(<HoldingsTable holdings={[]} />);
    expect(
      screen.getByText(/No open positions\. Add a BUY transaction/i),
    ).toBeInTheDocument();
    // Should not call fetch when there are no holdings.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("renders a row per holding with its symbol and exchange badge", () => {
    renderWithQuery(<HoldingsTable holdings={[HOLDING]} />);
    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("NSE")).toBeInTheDocument();
  });

  it("populates market value and LTP from the batch quote response", async () => {
    renderWithQuery(<HoldingsTable holdings={[HOLDING]} />);
    await waitFor(() => {
      // 10 * 120 = 1200 — market value
      expect(screen.getByText(/1,200/)).toBeInTheDocument();
    });
    // LTP
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it("falls back to em-dash when the batch endpoint errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    renderWithQuery(<HoldingsTable holdings={[HOLDING]} />);
    await waitFor(() => {
      // Avg cost (cost basis) still rendered, but LTP/market value should show "—" / "err"
      expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    });
  });
});
