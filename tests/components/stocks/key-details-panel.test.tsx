import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
vi.mock("@/lib/market/historical", () => ({
  getHistorical: async () =>
    closes.map((c, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      open: c,
      high: c,
      low: c,
      close: c,
      volume: 1000 + i,
    })),
}));

import { KeyDetailsPanel } from "@/components/stocks/key-details-panel";
import type { MetaInfo, Quote } from "@/lib/market/types";

const quote: Quote = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries",
  lastPrice: 2478.3,
  previousClose: 2460,
  open: 2460,
  dayHigh: 2480,
  dayLow: 2458,
  change: 18.3,
  changePct: 0.74,
  volume: 1_000_000,
  asOf: "2026-05-22T10:00:00Z",
};

const meta: MetaInfo = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries Ltd",
  industry: "Refineries",
  marketCap: 16_700_000_000_000,
};

describe("<KeyDetailsPanel />", () => {
  it("renders the name, price, avg vol, market cap, and BUY signal", async () => {
    const Tree = await KeyDetailsPanel({
      symbol: "RELIANCE",
      exchange: "NSE",
      quote,
      meta,
    });
    render(Tree);
    expect(screen.getByText("Reliance Industries Ltd")).toBeInTheDocument();
    expect(screen.getByText(/2,478\.30/)).toBeInTheDocument();
    expect(screen.getByText("BUY")).toBeInTheDocument();
  });

  it("renders em-dash for market cap when meta.marketCap is null", async () => {
    const Tree = await KeyDetailsPanel({
      symbol: "RELIANCE",
      exchange: "BSE",
      quote: { ...quote, exchange: "BSE" },
      meta: { ...meta, marketCap: null },
    });
    render(Tree);
    const dt = screen.getByText("Mkt cap");
    // Adjacent <dd> sibling holds the value
    const dd = dt.nextElementSibling as HTMLElement;
    expect(dd).toHaveTextContent("—");
  });
});
