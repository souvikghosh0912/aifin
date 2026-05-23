"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const SHORT_DATE = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

function formatTick(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return SHORT_DATE.format(d);
}

export function TimeframeChart({ initial, symbol, exchange }: Props) {
  const [range, setRange] = useState<Range>("3M");
  const [candles, setCandles] = useState<HistoricalCandle[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trend = useMemo(() => {
    if (candles.length < 2) return "flat" as const;
    const first = candles[0]!.close;
    const last = candles[candles.length - 1]!.close;
    if (last > first) return "up" as const;
    if (last < first) return "down" as const;
    return "flat" as const;
  }, [candles]);

  // Map trend → chart token. Up = success green, down = destructive red,
  // flat = muted foreground.
  const stroke =
    trend === "up"
      ? "hsl(var(--success))"
      : trend === "down"
        ? "hsl(var(--destructive))"
        : "hsl(var(--muted-foreground))";

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
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              data-active={r === range}
              onClick={() => selectRange(r)}
              className={cn(
                "rounded px-2.5 py-1 font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                r === range && "bg-accent text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <FullChartStub />
      </div>

      <div className="relative h-[440px] p-3 md:h-[520px]">
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
            <AreaChart
              data={candles}
              margin={{ left: 0, right: 0, top: 12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeOpacity={0.6}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickMargin={8}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTick}
                minTickGap={36}
              />
              <YAxis
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickMargin={6}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => formatINR(v, { compact: true })}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeDasharray: "3 3",
                  strokeOpacity: 0.5,
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  padding: "6px 8px",
                }}
                labelFormatter={(label: string) => formatTick(label)}
                formatter={(v: number) => [formatINR(v), "Close"]}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={stroke}
                strokeWidth={1.75}
                fill="url(#stockGrad)"
                fillOpacity={1}
                activeDot={{ r: 4, strokeWidth: 0, fill: stroke }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
