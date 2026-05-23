import { describe, expect, it } from "vitest";

import { computeSignal } from "@/lib/market/signal";

function series(values: number[]): number[] {
  return values;
}

describe("computeSignal", () => {
  it("returns null when fewer than 20 closes", () => {
    expect(computeSignal(series([1, 2, 3]))).toBeNull();
    expect(computeSignal(series(Array(19).fill(100)))).toBeNull();
  });

  it("returns BUY when last > SMA20 and 5-day momentum > 0", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 80 + i);
    expect(computeSignal(closes)).toBe("BUY");
  });

  it("returns SELL when last < SMA20 and 5-day momentum < 0", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 99 - i);
    expect(computeSignal(closes)).toBe("SELL");
  });

  it("returns NEUTRAL when last > SMA20 but momentum is negative", () => {
    // length 20. closes[14] = 130, closes[19] = 115 → mom5 = -15.
    // sma20 = (13*50 + 120+130+124+122+121+120+115)/20 ≈ 75.1, last=115 > sma20.
    const closes = [
      ...Array(13).fill(50),
      120, 130, 124, 122, 121, 120, 115,
    ];
    expect(computeSignal(closes)).toBe("NEUTRAL");
  });

  it("returns NEUTRAL when last < SMA20 but momentum is positive", () => {
    // length 20. closes[14] = 75, closes[19] = 90 → mom5 = +15.
    // sma20 = (13*200 + 80+75+78+82+85+88+90)/20 ≈ 158.9, last=90 < sma20.
    const closes = [
      ...Array(13).fill(200),
      80, 75, 78, 82, 85, 88, 90,
    ];
    expect(computeSignal(closes)).toBe("NEUTRAL");
  });
});
