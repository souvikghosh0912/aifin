import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NotesModal } from "@/components/watchlist/notes-modal";

const updateWatchlistNotes = vi.fn();
vi.mock("@/app/(app)/watchlist/actions", () => ({
  updateWatchlistNotes: (...args: unknown[]) => updateWatchlistNotes(...args),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "u1",
  symbol: "INFY",
  exchange: "NSE" as const,
  added_at: "2026-05-22T10:00:00Z",
  notes: "Watching ahead of earnings call on Friday.",
};

describe("<NotesModal />", () => {
  beforeEach(() => {
    updateWatchlistNotes.mockReset();
    refresh.mockReset();
  });

  it("opens in view mode with full notes and Edit/Delete buttons", () => {
    render(<NotesModal item={ITEM} onClose={vi.fn()} />);
    expect(screen.getByText(/Notes — INFY/)).toBeInTheDocument();
    expect(screen.getByText(/earnings call on Friday/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides Delete when notes is null", () => {
    render(<NotesModal item={{ ...ITEM, notes: null }} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  it("Edit → Save calls updateWatchlistNotes with trimmed value", async () => {
    updateWatchlistNotes.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NotesModal item={ITEM} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, "  Updated thesis  ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(updateWatchlistNotes).toHaveBeenCalledWith(ITEM.id, "Updated thesis");
    expect(onClose).toHaveBeenCalled();
  });

  it("Edit → Cancel reverts to view mode without saving", async () => {
    const user = userEvent.setup();
    render(<NotesModal item={ITEM} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/earnings call on Friday/)).toBeInTheDocument();
    expect(updateWatchlistNotes).not.toHaveBeenCalled();
  });

  it("Delete → confirm calls updateWatchlistNotes(id, null)", async () => {
    updateWatchlistNotes.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NotesModal item={ITEM} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(updateWatchlistNotes).toHaveBeenCalledWith(ITEM.id, null);
    expect(onClose).toHaveBeenCalled();
  });
});
