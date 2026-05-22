import { describe, expect, it } from "vitest";

import {
  cn,
  formatINR,
  formatNumber,
  formatPercent,
  signed,
} from "@/lib/utils";

describe("cn", () => {
  it("merges tailwind classes and dedupes conflicting ones", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", { "font-bold": true, "italic": false })).toBe(
      "text-sm font-bold",
    );
  });

  it("ignores falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
});

describe("formatINR", () => {
  it("formats values with the rupee symbol", () => {
    const out = formatINR(1234.5);
    expect(out).toContain("1,234.5");
    expect(out).toContain("₹");
  });

  it("uses compact notation when requested", () => {
    const out = formatINR(1_500_000, { compact: true });
    // en-IN compact uses L (lakh) — accept any compact suffix
    expect(out.length).toBeLessThan(formatINR(1_500_000).length);
  });

  it("returns em-dash for non-finite values", () => {
    expect(formatINR(NaN)).toBe("—");
    expect(formatINR(Infinity)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("formats integers with grouping", () => {
    // en-IN uses lakh grouping: 12,34,567 — assert digits and grouping, not US format
    const out = formatNumber(1234567);
    expect(out.replace(/[,\s]/g, "")).toBe("1234567");
    expect(out).toMatch(/,/);
  });

  it("returns em-dash for non-finite values", () => {
    expect(formatNumber(NaN)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("treats the input as a percentage value, not a ratio", () => {
    // 12.5 should mean 12.50%, not 1250%
    expect(formatPercent(12.5)).toMatch(/12\.50/);
  });

  it("returns em-dash for non-finite values", () => {
    expect(formatPercent(NaN)).toBe("—");
  });
});

describe("signed", () => {
  it("prefixes positive values with +", () => {
    expect(signed(12.345)).toBe("+12.35");
  });

  it("leaves negative values with their sign", () => {
    expect(signed(-3.2)).toBe("-3.20");
  });

  it("does not prefix zero", () => {
    expect(signed(0)).toBe("0.00");
  });

  it("returns em-dash for non-finite values", () => {
    expect(signed(NaN)).toBe("—");
  });
});
