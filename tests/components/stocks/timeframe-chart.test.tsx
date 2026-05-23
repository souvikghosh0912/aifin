import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimeframeChart } from "@/components/stocks/timeframe-chart";
import type { HistoricalCandle } from "@/lib/market/types";

function initial(): HistoricalCandle[] {
  return Array.from({ length: 5 }, (_, i) => ({
    date: `2026-04-0${i + 1}`,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1000,
  }));
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ candles: initial() }), { status: 200 }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the initial range as active", () => {
    render(
      <TimeframeChart initial={initial()} symbol="RELIANCE" exchange="NSE" />,
    );
    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("fetches when switching to 1Y", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ candles: initial() }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <TimeframeChart initial={initial()} symbol="RELIANCE" exchange="NSE" />,
    );

    await user.click(screen.getByRole("button", { name: "1Y" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/historical/RELIANCE?exchange=NSE&range=1Y",
        expect.anything(),
      );
    });
    expect(screen.getByRole("button", { name: "1Y" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("shows the error state when the fetch returns 502", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "upstream_down" }), { status: 502 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <TimeframeChart initial={initial()} symbol="RELIANCE" exchange="NSE" />,
    );

    await user.click(screen.getByRole("button", { name: "6M" }));

    expect(await screen.findByText(/Chart unavailable/i)).toBeInTheDocument();
  });

  it("renders 'Not enough data' when initial has < 2 candles", () => {
    render(<TimeframeChart initial={[]} symbol="RELIANCE" exchange="NSE" />);
    expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
  });
});
