"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import {
  buildVolatilitySmile,
  type SmilePoint,
} from "@/lib/market/volatility-smile";
import type { HistoricalCandle } from "@/lib/market/types";

interface Props {
  candles: HistoricalCandle[];
  loading: boolean;
}

function pickTicks(data: SmilePoint[]): number[] {
  if (data.length < 3) return [];
  const lo = data[0]!.strike;
  const hi = data[data.length - 1]!.strike;
  const mid = data[Math.floor(data.length / 2)]!.strike;
  return [lo, mid, hi];
}

export function VolatilityCurve({ candles, loading }: Props) {
  const data = useMemo(() => buildVolatilitySmile(candles), [candles]);
  const hasData = data.length >= 3;
  const tickStrikes = useMemo(() => pickTicks(data), [data]);

  return (
    <section className="border-t px-3 py-3">
      <h3 className="text-[13px] font-semibold text-foreground">
        Volatility curve (30 days)
      </h3>
      <div className="mt-2 h-[160px] w-full">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !hasData ? (
          <div className="grid h-full place-items-center text-[11px] text-muted-foreground">
            Not enough data.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
            >
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="strike"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={tickStrikes}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString("en-IN")}
              />
              <YAxis
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v: number) => `${v.toFixed(2)}%`}
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
                  fontSize: 11,
                  padding: "4px 6px",
                }}
                labelFormatter={(v: number) =>
                  `Strike ${v.toLocaleString("en-IN")}`
                }
                formatter={(v: number) => [`${v.toFixed(2)}%`, "IV"]}
              />
              <Line
                type="linear"
                dataKey="iv"
                stroke="hsl(212 89% 56%)"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          className="rounded-full border bg-card px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          More on options
        </button>
      </div>
    </section>
  );
}
