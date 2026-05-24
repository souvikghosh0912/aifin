"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CandlestickChart,
  Code2,
  Crosshair,
  Eraser,
  LineChart,
  Magnet,
  Maximize2,
  MousePointer2,
  Ruler,
  Settings,
  Sparkles,
  TrendingUp,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

import { FullChartStub } from "@/components/stocks/full-chart-stub";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoricalCandle, MarketsRange } from "@/lib/market/types";
import type { Exchange } from "@/types/database";
import { cn, formatINR } from "@/lib/utils";

interface Props {
  /** Symbol + exchange used to fetch ranges beyond the initial slice. */
  symbol: string;
  exchange: Exchange;
  /** Historical candles covering the initial range (1Y). */
  initial: HistoricalCandle[];
}

const RANGE_TABS: Array<{ label: string; range: MarketsRange }> = [
  { label: "1D", range: "1D" },
  { label: "1M", range: "1M" },
  { label: "3M", range: "3M" },
  { label: "1Y", range: "1Y" },
  { label: "5Y", range: "5Y" },
  { label: "All", range: "MAX" },
];

const INITIAL_RANGE: MarketsRange = "1Y";

const NARROW_FROM_INITIAL = new Set<MarketsRange>(["1M", "3M", "1Y"]);

const RANGE_DAYS: Partial<Record<MarketsRange, number>> = {
  "1M": 30,
  "3M": 90,
  "1Y": 365,
};

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
});

const MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
});

const YEAR_FMT = new Intl.DateTimeFormat("en-IN", { year: "numeric" });

const FULL_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatTick(dateStr: string, range: MarketsRange): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  if (range === "1D") return TIME_FMT.format(d);
  if (range === "MAX") return YEAR_FMT.format(d);
  if (range === "5Y") return MONTH_YEAR_FMT.format(d);
  return DATE_FMT.format(d);
}

function formatTooltipLabel(dateStr: string, range: MarketsRange): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  if (range === "1D") return `${DATE_FMT.format(d)} · ${TIME_FMT.format(d)}`;
  return FULL_DATE_FMT.format(d);
}

function sliceFromInitial(
  candles: HistoricalCandle[],
  range: MarketsRange,
): HistoricalCandle[] {
  const days = RANGE_DAYS[range];
  if (candles.length === 0 || !days) return candles;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const sliced = candles.filter((c) => {
    const t = new Date(c.date).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  return sliced.length >= 2 ? sliced : candles.slice(-2);
}

export function TimeframeChart({ symbol, exchange, initial }: Props) {
  const [range, setRange] = useState<MarketsRange>(INITIAL_RANGE);
  const [candles, setCandles] = useState<HistoricalCandle[]>(initial);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<MarketsRange, HistoricalCandle[]>());

  useEffect(() => {
    cacheRef.current.set(INITIAL_RANGE, initial);
  }, [initial]);

  const switchRange = useCallback(
    async (next: MarketsRange) => {
      setRange(next);

      const cached = cacheRef.current.get(next);
      if (cached) {
        setCandles(cached);
        return;
      }

      if (NARROW_FROM_INITIAL.has(next)) {
        const sliced = sliceFromInitial(initial, next);
        cacheRef.current.set(next, sliced);
        setCandles(sliced);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/historical/${encodeURIComponent(symbol)}?range=${next}&exchange=${exchange}`,
          { cache: "no-store" },
        );
        const body = (await res.json().catch(() => null)) as
          | { candles?: HistoricalCandle[]; error?: string }
          | null;
        if (!res.ok || !body?.candles) {
          toast.error(`Failed to load ${next} data`);
          return;
        }
        cacheRef.current.set(next, body.candles);
        setCandles(body.candles);
      } catch {
        toast.error(`Failed to load ${next} data`);
      } finally {
        setLoading(false);
      }
    },
    [symbol, exchange, initial],
  );

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

  const hasData = candles.length >= 2;

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
                tickFormatter={(d: string) => formatTick(d, range)}
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
                labelFormatter={(label: string) => formatTooltipLabel(label, range)}
                formatter={(v: number) => [formatINR(v), "Close"]}
              />
              <Area
                type="linear"
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
        {loading ? (
          <div className="pointer-events-none absolute inset-3 grid place-items-center">
            <Skeleton className="h-6 w-24" />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <div
          role="tablist"
          aria-label="Chart timeframe"
          className="flex items-center gap-0.5"
        >
          {RANGE_TABS.map((t) => {
            const active = t.range === range;
            return (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => void switchRange(t.range)}
                className={cn(
                  "min-w-[34px] rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5">
          <ToolbarIcon label="Compare">
            <Code2 className="h-3.5 w-3.5" />
          </ToolbarIcon>
          <ToolbarIcon label="Line">
            <LineChart className="h-3.5 w-3.5" />
          </ToolbarIcon>
          <ToolbarIcon label="Candles">
            <CandlestickChart className="h-3.5 w-3.5" />
          </ToolbarIcon>
          <ToolbarIcon label="Indicators">
            <Sparkles className="h-3.5 w-3.5" />
          </ToolbarIcon>
          <ToolbarIcon label="Fullscreen">
            <Maximize2 className="h-3.5 w-3.5" />
          </ToolbarIcon>
        </div>
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

function ToolbarIcon({
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
