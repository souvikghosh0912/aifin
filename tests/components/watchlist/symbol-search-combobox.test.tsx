import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SymbolSearchCombobox } from "@/components/watchlist/symbol-search-combobox";
import { renderWithQuery } from "../../helpers/render";

function mockResponses() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/search")) {
      return new Response(
        JSON.stringify({
          hits: [
            { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy" },
            { symbol: "TCS", exchange: "BSE", name: "Tata Consultancy" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.startsWith("/api/quotes/batch")) {
      return new Response(
        JSON.stringify({
          quotes: {
            "NSE:TCS": {
              symbol: "TCS",
              exchange: "NSE",
              name: "Tata Consultancy",
              lastPrice: 3500,
              previousClose: 3400,
              open: null,
              dayHigh: null,
              dayLow: null,
              change: 100,
              changePct: 2.94,
              volume: null,
              asOf: "2026-05-22T10:00:00Z",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("<SymbolSearchCombobox />", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces typing then renders enriched suggestions", async () => {
    const fetchMock = mockResponses();
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<SymbolSearchCombobox onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search symbol/i);
    await user.type(input, "tcs");

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(260);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/search?q=tcs"),
        expect.anything(),
      );
    });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) =>
        typeof c[0] === "string" ? c[0] : c[0]!.toString(),
      );
      expect(urls.some((u) => u.startsWith("/api/quotes/batch"))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getAllByText("TCS").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Tata Consultancy/i).length).toBe(2);
  });

  it("calls onSelect with the chosen hit", async () => {
    mockResponses();
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<SymbolSearchCombobox onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText(/search symbol/i), "tcs");
    await act(async () => {
      vi.advanceTimersByTime(260);
    });

    const nseRow = await screen.findByRole("option", { name: /TCS.*NSE/i });
    await user.click(nseRow);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "TCS", exchange: "NSE" }),
    );
  });
});
