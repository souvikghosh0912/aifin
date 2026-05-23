import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/market/top-gainers", () => ({
  getTopGainers: async () => [
    {
      symbol: "ADANIENT",
      name: "Adani Ent",
      lastPrice: 2400,
      change: 96.86,
      changePct: 4.21,
    },
    {
      symbol: "TATASTEEL",
      name: "Tata Steel",
      lastPrice: 140,
      change: 4.32,
      changePct: 3.18,
    },
  ],
}));

import { TopGainersList } from "@/components/stocks/top-gainers-list";

describe("<TopGainersList />", () => {
  it("renders rows as links, with the active symbol highlighted", async () => {
    const Tree = await TopGainersList({ activeSymbol: "TATASTEEL" });
    render(Tree);
    const adani = screen.getByRole("link", { name: /ADANIENT/i });
    expect(adani).toHaveAttribute("href", "/stocks/ADANIENT?exchange=NSE");

    const tata = screen.getByRole("link", { name: /TATASTEEL/i });
    expect(tata).toHaveClass("bg-accent/50");
  });

  it("renders the empty state when the list is empty", async () => {
    vi.resetModules();
    vi.doMock("@/lib/market/top-gainers", () => ({
      getTopGainers: async () => [],
    }));
    const { TopGainersList: Empty } = await import(
      "@/components/stocks/top-gainers-list"
    );
    const Tree = await Empty({ activeSymbol: "" });
    render(Tree);
    expect(screen.getByText(/Couldn't load top gainers/i)).toBeInTheDocument();
  });
});
