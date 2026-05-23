import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

import { SidebarSearch } from "@/components/stocks/sidebar-search";

describe("<SidebarSearch />", () => {
  beforeEach(() => {
    push.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            hits: [
              { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy" },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces typing then renders a suggestion and navigates on click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SidebarSearch />);
    const input = screen.getByPlaceholderText(/search stocks/i);
    await user.type(input, "tcs");

    await act(async () => {
      vi.advanceTimersByTime(260);
    });

    const row = await screen.findByRole("option", { name: /TCS/i });
    await user.click(row);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/stocks/TCS?exchange=NSE");
    });
  });
});
