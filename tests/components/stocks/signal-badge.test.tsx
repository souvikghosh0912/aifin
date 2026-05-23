import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalBadge } from "@/components/stocks/signal-badge";

describe("<SignalBadge />", () => {
  it("renders BUY with success tint", () => {
    render(<SignalBadge value="BUY" />);
    const el = screen.getByText("BUY");
    expect(el).toHaveClass("text-success");
  });

  it("renders SELL with destructive tint", () => {
    render(<SignalBadge value="SELL" />);
    expect(screen.getByText("SELL")).toHaveClass("text-destructive");
  });

  it("renders NEUTRAL with muted tint", () => {
    render(<SignalBadge value="NEUTRAL" />);
    expect(screen.getByText("NEUTRAL")).toHaveClass("text-muted-foreground");
  });

  it("renders em-dash for null", () => {
    render(<SignalBadge value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
