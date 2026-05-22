import { describe, expect, it } from "vitest";

import {
  normalizeSymbol,
  parseExchange,
  quoteKey,
} from "@/lib/market/symbols";

describe("normalizeSymbol", () => {
  it("uppercases and trims", () => {
    expect(normalizeSymbol("  reliance  ")).toBe("RELIANCE");
  });

  it("strips the Yahoo NSE suffix", () => {
    expect(normalizeSymbol("RELIANCE.NS")).toBe("RELIANCE");
    expect(normalizeSymbol("reliance.ns")).toBe("RELIANCE");
  });

  it("strips the Yahoo BSE suffix", () => {
    expect(normalizeSymbol("RELIANCE.BO")).toBe("RELIANCE");
  });

  it("leaves a clean symbol alone", () => {
    expect(normalizeSymbol("TCS")).toBe("TCS");
  });
});

describe("parseExchange", () => {
  it("returns BSE only when input is exactly BSE", () => {
    expect(parseExchange("BSE")).toBe("BSE");
    expect(parseExchange("bse")).toBe("BSE");
    expect(parseExchange(" bse ")).toBe("BSE");
  });

  it("defaults to NSE for anything else", () => {
    expect(parseExchange("NSE")).toBe("NSE");
    expect(parseExchange(null)).toBe("NSE");
    expect(parseExchange(undefined)).toBe("NSE");
    expect(parseExchange("")).toBe("NSE");
    expect(parseExchange("garbage")).toBe("NSE");
  });
});

describe("quoteKey", () => {
  it("composes a stable key with exchange prefix and normalized symbol", () => {
    expect(quoteKey("reliance.ns", "NSE")).toBe("NSE:RELIANCE");
    expect(quoteKey("TCS", "BSE")).toBe("BSE:TCS");
  });
});
