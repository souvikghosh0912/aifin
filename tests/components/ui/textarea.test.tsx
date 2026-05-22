import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Textarea } from "@/components/ui/textarea";

describe("<Textarea />", () => {
  it("renders with placeholder", () => {
    render(<Textarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });

  it("accepts user input", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="notes" />);
    const ta = screen.getByLabelText("notes") as HTMLTextAreaElement;
    await user.type(ta, "hello");
    expect(ta.value).toBe("hello");
  });

  it("forwards maxLength", () => {
    render(<Textarea aria-label="notes" maxLength={10} />);
    expect(screen.getByLabelText("notes")).toHaveAttribute("maxlength", "10");
  });
});
