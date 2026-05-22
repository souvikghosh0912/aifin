import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Badge } from "@/components/ui/badge";

describe("<Badge />", () => {
  it("renders its children", () => {
    render(<Badge>NSE</Badge>);
    expect(screen.getByText("NSE")).toBeInTheDocument();
  });

  it("applies the default variant class", () => {
    render(<Badge>x</Badge>);
    expect(screen.getByText("x")).toHaveClass("bg-primary");
  });

  it("applies the success variant when requested", () => {
    render(<Badge variant="success">Up</Badge>);
    expect(screen.getByText("Up")).toHaveClass("bg-success");
  });

  it("merges a custom className", () => {
    render(<Badge className="custom-class">x</Badge>);
    expect(screen.getByText("x")).toHaveClass("custom-class");
  });
});
