import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimeframeChart } from "@/components/stocks/timeframe-chart";
import type { HistoricalCandle } from "@/lib/market/types";

function buildCandles(days: number): HistoricalCandle[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return Array.from({ length: days }, (_, i) => {
    const t = now - (days - 1 - i) * dayMs;
    const date = new Date(t).toISOString().slice(0, 10);
    const close = 100 + i;
    return { date, open: close, high: close + 1, low: close - 1, close, volume: 1000 };
  });
}

function renderChart(candles: HistoricalCandle[]) {
  return render(
    <TimeframeChart symbol="RELIANCE" exchange="NSE" initial={candles} />,
  );
}

describe("<TimeframeChart />", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the initial 1Y range as active", () => {
    renderChart(buildCandles(260));
    expect(screen.getByRole("tab", { name: "1Y" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches between cached narrow ranges without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderChart(buildCandles(260));

    await user.click(screen.getByRole("tab", { name: "3M" }));

    expect(screen.getByRole("tab", { name: "3M" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches when switching to a range beyond the initial dataset", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candles: buildCandles(60) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderChart(buildCandles(260));

    await user.click(screen.getByRole("tab", { name: "5Y" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("range=5Y"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("renders all six range tabs", () => {
    renderChart(buildCandles(260));
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs.map((t) => t.textContent)).toEqual([
      "1D",
      "1M",
      "3M",
      "1Y",
      "5Y",
      "All",
    ]);
  });

  it("renders 'Not enough data' when initial has < 2 candles", () => {
    renderChart([]);
    expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
  });
});
