"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Quote } from "@/lib/market/types";
import {
  computeAllocation,
  computeTotals,
  enrichHoldings,
} from "@/lib/portfolio/calc";
import { cn, formatINR, formatPercent } from "@/lib/utils";
import type { Views } from "@/types/database";

import { AllocationChart } from "./allocation-chart";

type Holding = Views<"holdings_view">;

async function fetchQuotes(items: Holding[]) {
  if (items.length === 0) return {};
  const res = await fetch("/api/quotes/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((h) => ({ symbol: h.symbol, exchange: h.exchange })),
    }),
  });
  if (!res.ok) throw new Error("quote_fetch_failed");
  const data = (await res.json()) as {
    quotes: Record<string, Quote | { error: string }>;
  };
  return data.quotes;
}

export function DashboardSummary({ holdings }: { holdings: Holding[] }) {
  const { data, isLoading } = useQuery({
    queryKey: [
      "dashboard-quotes",
      holdings.map((h) => `${h.exchange}:${h.symbol}`).sort().join(","),
    ],
    queryFn: () => fetchQuotes(holdings),
    enabled: holdings.length > 0,
    refetchInterval: 30_000,
  });

  const enriched = enrichHoldings(holdings, data ?? {});
  const totals = computeTotals(enriched, holdings);
  const allocation = computeAllocation(enriched);

  const cards = [
    { label: "Market value", value: totals.marketValue, hint: "Current value of holdings" },
    { label: "Invested", value: totals.invested, hint: "Cost basis" },
    {
      label: "Total P&L",
      value: totals.unrealizedPnl,
      hint: formatPercent(totals.unrealizedPnlPct),
      color: true,
    },
    {
      label: "Day P&L",
      value: totals.dayChange,
      hint: formatPercent(totals.dayChangePct),
      color: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map((c) => {
          const tone =
            c.color && c.value > 0
              ? "text-success"
              : c.color && c.value < 0
                ? "text-destructive"
                : "";
          return (
            <Card key={c.label}>
              <CardContent className="flex flex-col gap-1 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </p>
                {isLoading && holdings.length > 0 ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <p
                    className={cn(
                      "num text-base font-semibold tabular-nums tracking-tight",
                      tone,
                    )}
                  >
                    {formatINR(c.value)}
                  </p>
                )}
                <p
                  className={cn(
                    "num text-[11px] tabular-nums text-muted-foreground",
                    tone,
                  )}
                >
                  {c.hint}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Allocation
          </h3>
          <AllocationChart data={allocation} />
        </CardContent>
      </Card>
    </div>
  );
}
