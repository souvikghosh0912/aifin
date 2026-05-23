import type { Signal } from "./types";

/**
 * Heuristic BUY/SELL/NEUTRAL signal from a closing-price series.
 *
 * Rule:
 *   sma20 = mean of last 20 closes
 *   mom5  = closes[-1] - closes[-6]
 *   BUY  if last > sma20 AND mom5 > 0
 *   SELL if last < sma20 AND mom5 < 0
 *   else NEUTRAL
 *
 * Returns null when fewer than 20 closes are available (caller should render `—`).
 */
export function computeSignal(closes: number[]): Signal | null {
  if (closes.length < 20) return null;

  const last = closes[closes.length - 1]!;
  const fiveAgo = closes[closes.length - 6]!;
  const window = closes.slice(-20);
  const sma20 = window.reduce((a, b) => a + b, 0) / window.length;
  const mom5 = last - fiveAgo;

  if (last > sma20 && mom5 > 0) return "BUY";
  if (last < sma20 && mom5 < 0) return "SELL";
  return "NEUTRAL";
}
