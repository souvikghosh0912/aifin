"use client";

import { ChevronLeft, ChevronRight, Code2, LineChart, Maximize2, Minus, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import type { HistoricalCandle, Range } from "@/lib/market/types";
import { cn, formatINR, formatNumber } from "@/lib/utils";

export interface MarketsCardData {
  id: string;
  name: string;
  shortName: string;
  kind: "index" | "stock";
  lastPrice: number | null;
  change: number | null;
  changePct: number | null;
}

interface Props {
  /** Title shown above the carousel (e.g. "Indices"). */
  title: string;
  /** Optional accent — e.g. flag emoji rendered before the title. */
  titleAccent?: React.ReactNode;
  /** All cards in this section. Paginated 4-at-a-time. */
  items: MarketsCardData[];
  /** Initial candles for the first item so the chart paints immediately. */
  initialCandles: HistoricalCandle[];
  /** Initial range that initialCandles correspond to. */
  initialRange: Range;
}

const PAGE_SIZE = 4;

// Display labels — 1M/3M/6M/1Y are wired to the API; the rest toast a
// "coming soon" hint so the row mirrors the TradingView reference visually.
const RANGE_TABS: Array<{ label: string; range: Range | null }> = [
  { label: "1D", range: null },
  { label: "1M", range: "1M" },
  { label: "3M", range: "3M" },
  { label: "1Y", range: "1Y" },
  { label: "5Y", range: null },
  { label: "All", range: null },
];

const INTRADAY_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

function tickerColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 65% 42%)`;
}

function formatChangePct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function MarketsSection({
  title,
  titleAccent,
  items,
  initialCandles,
  initialRange,
}: Props) {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [range, setRange] = useState<Range>(initialRange);
  const [candles, setCandles] = useState<HistoricalCandle[]>(initialCandles);
  const [loading, setLoading] = useState(false);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visible = useMemo(() => {
    const start = page * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const loadHistorical = useCallback(
    async (id: string, r: Range) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/markets/historical/${encodeURIComponent(id)}?range=${r}`,
          { cache: "no-store" },
        );
        const body = (await res.json().catch(() => null)) as
          | { candles?: HistoricalCandle[]; error?: string }
          | null;
        if (!res.ok || !body?.candles) {
          toast.error(`Failed to load chart for ${id}`);
          return;
        }
        setCandles(body.candles);
      } catch {
        toast.error(`Failed to load chart for ${id}`);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // When the selection or range changes, refetch unless we're already showing
  // the initial server-rendered series (id matches first item + initialRange).
  useEffect(() => {
    if (!selected) return;
    const isInitial =
      selected.id === items[0]?.id && range === initialRange;
    if (isInitial) {
      setCandles(initialCandles);
      return;
    }
    void loadHistorical(selected.id, range);
  }, [selected, range, items, initialCandles, initialRange, loadHistorical]);

  if (!selected) return null;

  const dir =
    candles.length >= 2
      ? (candles[candles.length - 1]!.close ?? 0) >=
        (candles[0]!.close ?? 0)
        ? "up"
        : "down"
      : "flat";
  const stroke =
    dir === "up"
      ? "hsl(var(--success))"
      : dir === "down"
        ? "hsl(var(--destructive))"
        : "hsl(var(--muted-foreground))";

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-1 text-2xl font-extrabold tracking-tight text-foreground">
        {titleAccent ? (
          <span aria-hidden className="mr-1 text-2xl leading-none">
            {titleAccent}
          </span>
        ) : null}
        <span>{title}</span>
        <ChevronRight
          className="h-5 w-5 -translate-y-px text-foreground"
          strokeWidth={2.75}
          aria-hidden
        />
      </h2>

      <div className="relative">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((it) => {
            const active = it.id === selectedId;
            const up = (it.changePct ?? 0) >= 0;
            const colour = tickerColor(it.shortName);
            return (
              <button
                key={it.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(it.id)}
                className={cn(
                  "group flex min-w-0 items-start gap-2.5 rounded-2xl border bg-card px-3 py-2.5 text-left transition-all hover:border-foreground/20 hover:bg-accent",
                  active
                    ? "border-foreground/40 bg-accent/60 shadow-sm"
                    : "border-border",
                )}
              >
                <span
                  aria-hidden
                  style={{ background: colour, color: "white" }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold leading-none"
                >
                  {it.shortName.slice(0, 2)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {it.name}
                    </span>
                    <Minus
                      className="h-3 w-3 shrink-0 text-muted-foreground"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1.5 text-[13px] leading-tight">
                    <span className="num font-medium tabular-nums text-foreground">
                      {it.lastPrice == null ? "—" : formatNumber(it.lastPrice)}
                    </span>
                    {it.kind === "stock" ? (
                      <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                        INR
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "num text-[12px] font-semibold tabular-nums",
                        up ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatChangePct(it.changePct)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, PAGE_SIZE - visible.length) }).map(
            (_, i) => (
              <div key={`pad-${i}`} aria-hidden className="hidden sm:block" />
            ),
          )}
        </div>

        {pageCount > 1 ? (
          <>
            {page > 0 ? (
              <CarouselArrow
                direction="prev"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />
            ) : null}
            {page < pageCount - 1 ? (
              <CarouselArrow
                direction="next"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="relative h-[360px] p-3">
          {candles.length < 2 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Not enough data to chart.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={candles}
                  margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`mgrad-${selected.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={8}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={36}
                    tickFormatter={(d: string) => {
                      const dt = new Date(d);
                      return Number.isFinite(dt.getTime())
                        ? INTRADAY_FMT.format(dt)
                        : d;
                    }}
                  />
                  <YAxis
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={6}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) => formatNumber(v)}
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
                    formatter={(v: number) => [
                      selected.kind === "stock"
                        ? formatINR(v)
                        : formatNumber(v),
                      "Close",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={stroke}
                    strokeWidth={1.75}
                    fill={`url(#mgrad-${selected.id})`}
                    fillOpacity={1}
                    activeDot={{ r: 4, strokeWidth: 0, fill: stroke }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {loading ? (
                <div className="pointer-events-none absolute inset-3 grid place-items-center">
                  <Skeleton className="h-6 w-24" />
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            {RANGE_TABS.map((t) => {
              const active = t.range != null && t.range === range;
              return (
                <button
                  key={t.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    if (t.range == null) {
                      toast.info(`${t.label} — coming soon`);
                      return;
                    }
                    setRange(t.range);
                  }}
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
            <ToolbarIcon label="Indicators">
              <Sparkles className="h-3.5 w-3.5" />
            </ToolbarIcon>
            <ToolbarIcon label="Fullscreen">
              <Maximize2 className="h-3.5 w-3.5" />
            </ToolbarIcon>
          </div>
        </div>
      </div>
    </section>
  );
}

function CarouselArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "next" ? ChevronRight : ChevronLeft;
  const label = direction === "next" ? "Show next 4" : "Show previous 4";
  const side = direction === "next" ? "-right-3" : "-left-3";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border bg-card text-foreground shadow-md transition-colors hover:bg-accent",
        side,
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
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
