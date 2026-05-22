"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Quote } from "@/lib/market/types";
import {
  enrichHoldings,
  type HoldingWithMarket,
} from "@/lib/portfolio/calc";
import { cn, formatINR, formatNumber, formatPercent } from "@/lib/utils";
import type { Views } from "@/types/database";

type Holding = Views<"holdings_view">;

interface BatchResponse {
  quotes: Record<string, Quote | { error: string }>;
}

async function fetchQuotes(items: Holding[]): Promise<BatchResponse["quotes"]> {
  if (items.length === 0) return {};
  const res = await fetch("/api/quotes/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((h) => ({ symbol: h.symbol, exchange: h.exchange })),
    }),
  });
  if (!res.ok) throw new Error("Failed to load quotes");
  const data = (await res.json()) as BatchResponse;
  return data.quotes;
}

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "quotes",
      holdings.map((h) => `${h.exchange}:${h.symbol}`).sort().join(","),
    ],
    queryFn: () => fetchQuotes(holdings),
    enabled: holdings.length > 0,
    refetchInterval: 30_000,
  });

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No open positions. Add a BUY transaction to get started.
        </p>
      </div>
    );
  }

  const enriched: HoldingWithMarket[] = enrichHoldings(holdings, data ?? {});

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Avg cost</TableHead>
            <TableHead className="text-right">LTP</TableHead>
            <TableHead className="text-right">Invested</TableHead>
            <TableHead className="text-right">Market value</TableHead>
            <TableHead className="text-right">Day P&amp;L</TableHead>
            <TableHead className="text-right">Total P&amp;L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enriched.map((row) => (
            <TableRow key={`${row.holding.exchange}:${row.holding.symbol}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.holding.symbol}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {row.holding.exchange}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="num text-right">
                {formatNumber(row.holding.quantity)}
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {formatINR(row.holding.avg_cost)}
              </TableCell>
              <TableCell className="num text-right">
                {isLoading && !row.quote ? (
                  <Skeleton className="ml-auto h-4 w-16" />
                ) : row.quote ? (
                  formatINR(row.quote.lastPrice)
                ) : isError ? (
                  <span className="text-muted-foreground">err</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="num text-right">
                {formatINR(row.holding.invested_value)}
              </TableCell>
              <TableCell className="num text-right font-medium">
                {row.quote ? formatINR(row.marketValue) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "num text-right",
                  row.dayChange > 0 && "text-success",
                  row.dayChange < 0 && "text-destructive",
                )}
              >
                {row.quote ? (
                  <div className="flex items-center justify-end gap-1">
                    {row.dayChange >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{formatINR(row.dayChange)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatPercent(row.dayChangePct)})
                    </span>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "num text-right font-medium",
                  row.unrealizedPnl > 0 && "text-success",
                  row.unrealizedPnl < 0 && "text-destructive",
                )}
              >
                {row.quote ? (
                  <>
                    {formatINR(row.unrealizedPnl)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({formatPercent(row.unrealizedPnlPct)})
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
