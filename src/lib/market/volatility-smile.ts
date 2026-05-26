import type { HistoricalCandle } from "@/lib/market/types";

/** Annualized realized volatility (%) over the last `window` daily closes. */
function realizedVolPct(closes: number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const a = slice[i - 1]!;
    const b = slice[i]!;
    if (a <= 0 || b <= 0) continue;
    rets.push(Math.log(b / a));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  return sd * Math.sqrt(252) * 100;
}

/**
 * Choose a "nice" strike step (1/2/5 × 10^n) close to ~5% of spot, so the
 * generated smile lands on round-looking strike prices like the reference
 * picture's 18350 / 22800 / 27250.
 */
function niceStrikeStep(spot: number): number {
  if (spot <= 0) return 1;
  const target = spot * 0.05;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const n = target / pow;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * pow;
}

export interface SmilePoint {
  strike: number;
  iv: number;
}

/**
 * Build a synthetic 30-day IV smile across strikes around the last close.
 * Uses realized vol as a proxy for ATM IV; wings rise parabolically with
 * a mild left-skew (the typical equity smirk where puts trade richer).
 */
export function buildVolatilitySmile(
  candles: HistoricalCandle[],
): SmilePoint[] {
  if (candles.length < 22) return [];
  const closes = candles.map((c) => c.close);
  const spot = closes[closes.length - 1]!;
  const atm = realizedVolPct(closes, 21);
  if (atm == null || spot <= 0) return [];

  const step = niceStrikeStep(spot);
  const atmStrike = Math.round(spot / step) * step;
  const offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  return offsets.map((k) => {
    const strike = atmStrike + k * step;
    const m = (strike - spot) / spot;
    const iv = atm * (1 + 7 * m * m - 0.6 * m);
    return { strike, iv: Math.max(1, iv) };
  });
}
