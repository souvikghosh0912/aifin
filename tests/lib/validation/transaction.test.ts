import { describe, expect, it } from "vitest";

import { TransactionInputSchema } from "@/lib/validation/transaction";

const baseInput = {
  symbol: "reliance",
  exchange: "NSE",
  side: "BUY",
  quantity: 10,
  price: 2500,
  fees: 5,
  traded_at: "2026-01-15",
};

describe("TransactionInputSchema", () => {
  it("accepts a well-formed BUY", () => {
    const parsed = TransactionInputSchema.parse(baseInput);
    expect(parsed.symbol).toBe("RELIANCE");
    expect(parsed.exchange).toBe("NSE");
    expect(parsed.side).toBe("BUY");
    expect(parsed.quantity).toBe(10);
    expect(parsed.fees).toBe(5);
  });

  it("uppercases and trims the symbol", () => {
    const parsed = TransactionInputSchema.parse({
      ...baseInput,
      symbol: "  tcs  ",
    });
    expect(parsed.symbol).toBe("TCS");
  });

  it("coerces numeric strings from form inputs", () => {
    const parsed = TransactionInputSchema.parse({
      ...baseInput,
      quantity: "5",
      price: "100.25",
      fees: "0",
    });
    expect(parsed.quantity).toBe(5);
    expect(parsed.price).toBe(100.25);
    expect(parsed.fees).toBe(0);
  });

  it("defaults fees to 0 when omitted", () => {
    const { fees: _ignored, ...rest } = baseInput;
    const parsed = TransactionInputSchema.parse(rest);
    expect(parsed.fees).toBe(0);
  });

  it("rejects an empty symbol", () => {
    const result = TransactionInputSchema.safeParse({
      ...baseInput,
      symbol: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown exchange", () => {
    const result = TransactionInputSchema.safeParse({
      ...baseInput,
      exchange: "NASDAQ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown side", () => {
    const result = TransactionInputSchema.safeParse({
      ...baseInput,
      side: "HOLD",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive quantity", () => {
    expect(
      TransactionInputSchema.safeParse({ ...baseInput, quantity: 0 }).success,
    ).toBe(false);
    expect(
      TransactionInputSchema.safeParse({ ...baseInput, quantity: -1 }).success,
    ).toBe(false);
  });

  it("rejects negative price and fees", () => {
    expect(
      TransactionInputSchema.safeParse({ ...baseInput, price: -1 }).success,
    ).toBe(false);
    expect(
      TransactionInputSchema.safeParse({ ...baseInput, fees: -0.01 }).success,
    ).toBe(false);
  });

  it("accepts a zero price (e.g., bonus issue)", () => {
    expect(
      TransactionInputSchema.safeParse({ ...baseInput, price: 0 }).success,
    ).toBe(true);
  });

  it("rejects an empty traded_at", () => {
    const result = TransactionInputSchema.safeParse({
      ...baseInput,
      traded_at: "",
    });
    expect(result.success).toBe(false);
  });

  it("caps notes at 500 chars", () => {
    expect(
      TransactionInputSchema.safeParse({
        ...baseInput,
        notes: "x".repeat(500),
      }).success,
    ).toBe(true);
    expect(
      TransactionInputSchema.safeParse({
        ...baseInput,
        notes: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
