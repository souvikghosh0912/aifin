import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

import { StockHeader } from "@/components/stocks/stock-header";
import type { Quote, MetaInfo } from "@/lib/market/types";

const quote: Quote = {
  symbol: "RELIANCE",
  exchange: "NSE",
  name: "Reliance Industries",
  lastPrice: 2478.3,
  previousClose: 2459.85,
  open: 2460,
  dayHigh: 2480,
  dayLow: 2458,
  change: 18.45,
  changePct: 0.75,
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

describe("<StockHeader />", () => {
  it("renders meta name, symbol, exchange, price, and signed change", () => {
    render(<StockHeader quote={quote} meta={meta} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Reliance Industries Ltd",
    );
    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("NSE")).toBeInTheDocument();
    expect(screen.getByText(/2,478\.30/)).toBeInTheDocument();
    expect(screen.getByText(/\+18\.45/)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.75%/)).toBeInTheDocument();
  });

  it("falls back to quote.name when meta.name is null", () => {
    render(<StockHeader quote={quote} meta={{ ...meta, name: null }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Reliance Industries",
    );
  });
});
