"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Crosshair,
  Eraser,
  Magnet,
  MousePointer2,
  Ruler,
  Settings,
  TrendingUp,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

import { FullChartStub } from "@/components/stocks/full-chart-stub";
import type { HistoricalCandle, Range } from "@/lib/market/types";
import { cn, formatINR } from "@/lib/utils";

interface Props {
  /** Historical candles covering at least the longest range (1Y). */
  initial: HistoricalCandle[];
}

const RANGES: Range[] = ["1M", "3M", "6M", "1Y"];

const RANGE_LABELS: Record<Range, string> = {
  "1M": "1 month",
  "3M": "3 months",
  "6M": "6 months",
  "1Y": "1 year",
};

const RANGE_DAYS: Record<Range, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

const SHORT_DATE = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

function formatTick(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return SHORT_DATE.format(d);
}

function sliceRange(
  candles: HistoricalCandle[],
  range: Range,
): HistoricalCandle[] {
  if (candles.length === 0) return candles;
  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const sliced = candles.filter((c) => {
    const t = new Date(c.date).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  // Fallback: if the dataset is older than the cutoff (e.g. weekend/holiday
  // gap pushes everything past it), keep at least the last 2 candles so the
  // chart still draws.
  return sliced.length >= 2 ? sliced : candles.slice(-2);
}

function rangePct(candles: HistoricalCandle[]): number | null {
  if (candles.length < 2) return null;
  const first = candles[0]!.close;
  const last = candles[candles.length - 1]!.close;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

export function TimeframeChart({ initial }: Props) {
  const [range, setRange] = useState<Range>("3M");

  const slices = useMemo(() => {
    const m = {} as Record<Range, HistoricalCandle[]>;
    for (const r of RANGES) m[r] = sliceRange(initial, r);
    return m;
  }, [initial]);

  const candles = slices[range];

  const trend = useMemo(() => {
    if (candles.length < 2) return "flat" as const;
    const first = candles[0]!.close;
    const last = candles[candles.length - 1]!.close;
    if (last > first) return "up" as const;
    if (last < first) return "down" as const;
    return "flat" as const;
  }, [candles]);

  const stroke =
    trend === "up"
      ? "hsl(var(--success))"
      : trend === "down"
        ? "hsl(var(--destructive))"
        : "hsl(var(--muted-foreground))";

  const hasData = initial.length >= 2;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1">
        <div className="flex items-center gap-0.5">
          <ToolIcon label="Cursor">
            <MousePointer2 className="h-3.5 w-3.5" />
          </ToolIcon>
          <ToolIcon label="Crosshair">
            <Crosshair className="h-3.5 w-3.5" />
          </ToolIcon>
          <ToolIcon label="Trend line">
            <TrendingUp className="h-3.5 w-3.5" />
          </ToolIcon>
          <ToolIcon label="Measure">
            <Ruler className="h-3.5 w-3.5" />
          </ToolIcon>
          <ToolIcon label="Eraser">
            <Eraser className="h-3.5 w-3.5" />
          </ToolIcon>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <ToolIcon label="Magnet">
            <Magnet className="h-3.5 w-3.5" />
          </ToolIcon>
          <ToolIcon label="Zoom">
            <ZoomIn className="h-3.5 w-3.5" />
          </ToolIcon>
          <ToolIcon label="Settings">
            <Settings className="h-3.5 w-3.5" />
          </ToolIcon>
        </div>
        <FullChartStub />
      </div>

      <div className="relative h-[440px] p-3 md:h-[520px]">
        {!hasData ? (
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

      <div
        role="tablist"
        aria-label="Chart timeframe"
        className="grid grid-cols-4 gap-px border-t bg-border"
      >
        {RANGES.map((r) => {
          const pct = rangePct(slices[r]);
          const isActive = r === range;
          const up = (pct ?? 0) >= 0;
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive}
              onClick={() => setRange(r)}
              className={cn(
                "flex flex-col items-start gap-0.5 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent",
                isActive && "bg-accent",
              )}
            >
              <span className="text-xs font-medium text-foreground">
                {RANGE_LABELS[r]}
              </span>
              <span
                className={cn(
                  "num text-xs font-semibold tabular-nums",
                  pct == null
                    ? "text-muted-foreground"
                    : up
                      ? "text-success"
                      : "text-destructive",
                )}
              >
                {pct == null
                  ? "—"
                  : `${up ? "+" : ""}${pct.toFixed(2)}%`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToolIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => toast.info(`${label} — coming soon`)}
      className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
