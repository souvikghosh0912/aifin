import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

import { ExchangeSelect } from "@/components/stocks/exchange-select";

// Radix Select calls hasPointerCapture/setPointerCapture/scrollIntoView,
// none of which jsdom implements.
beforeAll(() => {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  });
});

describe("<ExchangeSelect />", () => {
  it("shows the current exchange and replaces the URL on change", async () => {
    replace.mockReset();
    const user = userEvent.setup();
    render(<ExchangeSelect symbol="RELIANCE" current="NSE" />);

    expect(screen.getByText("NSE")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "BSE" }));

    expect(replace).toHaveBeenCalledWith("/stocks/RELIANCE?exchange=BSE");
  });
});
