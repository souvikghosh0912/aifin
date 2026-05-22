import type { Quote } from "@/lib/market/types";
import type { Tables, Views } from "@/types/database";

type Transaction = Tables<"transactions">;
type Holding = Views<"holdings_view">;

/**
 * Compute weighted-average holdings from a list of transactions.
 * Useful when the DB view isn't available (e.g., client-side previews).
 */
export function computeHoldings(transactions: Transaction[]): Holding[] {
  const acc = new Map<
    string,
    {
      user_id: string;
      portfolio_id: string;
      symbol: string;
      exchange: Holding["exchange"];
      quantity: number;
      grossBuy: number;
      buyQty: number;
      grossSell: number;
      sellQty: number;
    }
  >();

  for (const tx of transactions) {
    const key = `${tx.portfolio_id}:${tx.exchange}:${tx.symbol}`;
    const cur = acc.get(key) ?? {
      user_id: tx.user_id,
      portfolio_id: tx.portfolio_id,
      symbol: tx.symbol,
      exchange: tx.exchange,
      quantity: 0,
      grossBuy: 0,
      buyQty: 0,
      grossSell: 0,
      sellQty: 0,
    };
    if (tx.side === "BUY") {
      cur.quantity += tx.quantity;
      cur.grossBuy += tx.quantity * tx.price + tx.fees;
      cur.buyQty += tx.quantity;
    } else {
      cur.quantity -= tx.quantity;
      cur.grossSell += tx.quantity * tx.price - tx.fees;
      cur.sellQty += tx.quantity;
    }
    acc.set(key, cur);
  }

  const out: Holding[] = [];
  for (const v of acc.values()) {
    if (v.quantity <= 0) continue;
    const avg_cost = v.buyQty > 0 ? v.grossBuy / v.buyQty : 0;
    out.push({
      user_id: v.user_id,
      portfolio_id: v.portfolio_id,
      symbol: v.symbol,
      exchange: v.exchange,
      quantity: v.quantity,
      avg_cost,
      invested_value: v.quantity * avg_cost,
      realized_pnl: v.grossSell - v.sellQty * avg_cost,
    });
  }
  return out;
}

export interface HoldingWithMarket {
  holding: Holding;
  quote: Quote | null;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dayChange: number;
  dayChangePct: number;
}

export function enrichHoldings(
  holdings: Holding[],
  quotes: Record<string, Quote | { error: string } | undefined>,
): HoldingWithMarket[] {
  return holdings.map((h) => {
    const key = `${h.exchange}:${h.symbol}`;
    const raw = quotes[key];
    const quote =
      raw && "lastPrice" in (raw as object) ? (raw as Quote) : null;
    if (!quote) {
      return {
        holding: h,
        quote: null,
        marketValue: h.invested_value,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        dayChange: 0,
        dayChangePct: 0,
      };
    }
    const marketValue = h.quantity * quote.lastPrice;
    const unrealizedPnl = marketValue - h.invested_value;
    const unrealizedPnlPct =
      h.invested_value > 0 ? (unrealizedPnl / h.invested_value) * 100 : 0;
    const dayChange = h.quantity * (quote.lastPrice - quote.previousClose);
    const dayChangePct = quote.changePct;
    return {
      holding: h,
      quote,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
      dayChange,
      dayChangePct,
    };
  });
}

export interface PortfolioTotals {
  invested: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dayChange: number;
  dayChangePct: number;
  realizedPnl: number;
}

export function computeTotals(
  enriched: HoldingWithMarket[],
  holdings: Holding[],
): PortfolioTotals {
  const invested = enriched.reduce((s, h) => s + h.holding.invested_value, 0);
  const marketValue = enriched.reduce((s, h) => s + h.marketValue, 0);
  const unrealizedPnl = marketValue - invested;
  const unrealizedPnlPct = invested > 0 ? (unrealizedPnl / invested) * 100 : 0;
  const dayChange = enriched.reduce((s, h) => s + h.dayChange, 0);
  const previousValue = marketValue - dayChange;
  const dayChangePct = previousValue > 0 ? (dayChange / previousValue) * 100 : 0;
  const realizedPnl = holdings.reduce((s, h) => s + h.realized_pnl, 0);
  return {
    invested,
    marketValue,
    unrealizedPnl,
    unrealizedPnlPct,
    dayChange,
    dayChangePct,
    realizedPnl,
  };
}

export interface AllocationSlice {
  symbol: string;
  exchange: Holding["exchange"];
  value: number;
  pct: number;
}

export function computeAllocation(
  enriched: HoldingWithMarket[],
): AllocationSlice[] {
  const total = enriched.reduce((s, h) => s + h.marketValue, 0);
  if (total <= 0) return [];
  return enriched
    .map((h) => ({
      symbol: h.holding.symbol,
      exchange: h.holding.exchange,
      value: h.marketValue,
      pct: (h.marketValue / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Newton-method XIRR. Returns annualized return as a decimal (0.12 = 12%).
 * Returns null if it doesn't converge.
 */
export function xirr(
  cashflows: { amount: number; date: Date }[],
  guess = 0.1,
): number | null {
  if (cashflows.length < 2) return null;
  const positive = cashflows.some((c) => c.amount > 0);
  const negative = cashflows.some((c) => c.amount < 0);
  if (!positive || !negative) return null;

  const sorted = [...cashflows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const t0 = sorted[0]!.date.getTime();
  const years = sorted.map((c) => (c.date.getTime() - t0) / (365.25 * 86_400_000));
  const amts = sorted.map((c) => c.amount);

  const npv = (r: number) =>
    amts.reduce((s, a, i) => s + a / Math.pow(1 + r, years[i]!), 0);
  const dnpv = (r: number) =>
    amts.reduce(
      (s, a, i) => s - (years[i]! * a) / Math.pow(1 + r, years[i]! + 1),
      0,
    );

  let r = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    const fp = dnpv(r);
    if (Math.abs(fp) < 1e-10) break;
    const next = r - f / fp;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - r) < 1e-7) return next;
    r = next;
    if (r < -0.999) r = -0.999;
  }
  return Math.abs(npv(r)) < 1 ? r : null;
}
