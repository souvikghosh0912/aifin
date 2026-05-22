import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { renderWithQuery } from "../../helpers/render";
import type { Tables } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(app)/watchlist/actions", () => ({
  removeWatchlistItem: vi.fn(async () => ({ ok: true })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

type Item = Tables<"watchlist_items">;

const SHORT: Item = {
  id: "a",
  user_id: "u1",
  symbol: "INFY",
  exchange: "NSE",
  added_at: "2026-05-22T10:00:00Z",
  notes: "Short note",
};

const LONG: Item = {
  id: "b",
  user_id: "u1",
  symbol: "TCS",
  exchange: "NSE",
  added_at: "2026-05-22T10:00:00Z",
  notes: "x".repeat(200),
};

const EMPTY: Item = {
  id: "c",
  user_id: "u1",
  symbol: "WIPRO",
  exchange: "NSE",
  added_at: "2026-05-22T10:00:00Z",
  notes: null,
};

describe("<WatchlistTable /> notes column", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ quotes: {} }), { status: 200 }),
      ),
    );
  });

  it("renders em-dash for null notes", () => {
    renderWithQuery(<WatchlistTable items={[EMPTY]} />);
    // Notes null renders <span>—</span>; price cells render bare "—" text nodes.
    // Use getAllByText to avoid the multiple-match error from the price columns.
    const notesDash = screen
      .getAllByText("—")
      .find((el) => el.tagName === "SPAN");
    expect(notesDash).toBeDefined();
  });

  it("renders short notes verbatim with no ellipsis icon", () => {
    renderWithQuery(<WatchlistTable items={[SHORT]} />);
    expect(screen.getByText("Short note")).toBeInTheDocument();
    expect(screen.queryByLabelText(/open full notes/i)).toBeNull();
  });

  it("renders 150-char slice + ellipsis trigger for long notes, opens modal on click", async () => {
    const user = userEvent.setup();
    renderWithQuery(<WatchlistTable items={[LONG]} />);
    const trigger = screen.getByLabelText(/open full notes/i);
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByText(/Notes — TCS/)).toBeInTheDocument();
  });
});
