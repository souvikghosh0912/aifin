import { describe, expect, it } from "vitest";

import { truncateText } from "@/lib/text";

describe("truncateText", () => {
  it("returns the input unchanged when length <= max", () => {
    expect(truncateText("hello", 10)).toEqual({ text: "hello", truncated: false });
  });

  it("returns input unchanged when exactly at max", () => {
    expect(truncateText("abcde", 5)).toEqual({ text: "abcde", truncated: false });
  });

  it("slices to max chars and flags truncated when longer", () => {
    expect(truncateText("0123456789abcdef", 10)).toEqual({
      text: "0123456789",
      truncated: true,
    });
  });

  it("treats null/undefined/empty as empty non-truncated", () => {
    expect(truncateText(null, 10)).toEqual({ text: "", truncated: false });
    expect(truncateText(undefined, 10)).toEqual({ text: "", truncated: false });
    expect(truncateText("", 10)).toEqual({ text: "", truncated: false });
  });
});
