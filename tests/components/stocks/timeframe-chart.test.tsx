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

  it("renders the initial range as active", () => {
    render(<TimeframeChart initial={buildCandles(260)} />);
    expect(screen.getByRole("tab", { name: /3 months/i })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("switches range on click without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<TimeframeChart initial={buildCandles(260)} />);

    await user.click(screen.getByRole("tab", { name: /1 year/i }));

    expect(screen.getByRole("tab", { name: /1 year/i })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a percentage for each range", () => {
    render(<TimeframeChart initial={buildCandles(260)} />);
    // 4 range tabs, all with a numeric % since the series is monotonically up
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      expect(tab.textContent).toMatch(/[+-]?\d+\.\d{2}%/);
    }
  });

  it("renders 'Not enough data' when initial has < 2 candles", () => {
    render(<TimeframeChart initial={[]} />);
    expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
  });
});
