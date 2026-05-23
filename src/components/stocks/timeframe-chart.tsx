"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FullChartStub } from "@/components/stocks/full-chart-stub";
import { Skeleton } from "@/components/ui/skeleton";
import type { Exchange } from "@/types/database";
import type { HistoricalCandle, Range } from "@/lib/market/types";
import { cn, formatINR } from "@/lib/utils";

interface Props {
  initial: HistoricalCandle[];
  symbol: string;
  exchange: Exchange;
}

const RANGES: Range[] = ["1M", "3M", "6M", "1Y"];

export function TimeframeChart({ initial, symbol, exchange }: Props) {
  const [range, setRange] = useState<Range>("3M");
  const [candles, setCandles] = useState<HistoricalCandle[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function selectRange(next: Range) {
    if (next === range && !error) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRange(next);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/historical/${encodeURIComponent(symbol)}?exchange=${exchange}&range=${next}`,
        { signal: ac.signal },
      );
      if (!res.ok) {
        setError("Chart unavailable. Try again later.");
        return;
      }
      const body = (await res.json()) as { candles: HistoricalCandle[] };
      setCandles(body.candles ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Chart unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 text-xs">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            data-active={r === range}
            onClick={() => selectRange(r)}
            className={cn(
              "rounded px-2.5 py-1 font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
              r === range && "bg-accent text-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="relative h-80 rounded-lg border bg-card p-3">
        <FullChartStub className="absolute right-2 top-2 z-10" />
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : error ? (
          <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => selectRange(range)}
              className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
            >
              Retry
            </button>
          </div>
        ) : candles.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough data to chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={candles} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatINR(v, { compact: true })}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatINR(v)}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="hsl(var(--chart-1))"
                fillOpacity={1}
                fill="url(#stockGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
