"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Profile } from "@/components/markets/rail-sections/profile";
import { VolatilityCurve } from "@/components/markets/rail-sections/volatility-curve";
import { Skeleton } from "@/components/ui/skeleton";
import type { Exchange } from "@/types/database";
import type { HistoricalCandle } from "@/lib/market/types";
import { cn } from "@/lib/utils";

interface PropsCommon {
  /** Disable the wrapper border/padding so the parent can space sections. */
  className?: string;
}

type Props =
  | (PropsCommon & {
      kind: "stock";
      symbol: string;
      exchange: Exchange;
    })
  | (PropsCommon & {
      kind: "index";
      marketId: string;
    });

interface Endpoints {
  oneYear: string;
  fiveYear: string;
}

function buildEndpoints(props: Props): Endpoints {
  if (props.kind === "stock") {
    const base = `/api/historical/${encodeURIComponent(props.symbol)}?exchange=${props.exchange}`;
    return { oneYear: `${base}&range=1Y`, fiveYear: `${base}&range=5Y` };
  }
  const base = `/api/markets/historical/${encodeURIComponent(props.marketId)}`;
  return { oneYear: `${base}?range=1Y`, fiveYear: `${base}?range=5Y` };
}

async function fetchCandles(url: string): Promise<HistoricalCandle[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as
      | { candles?: HistoricalCandle[] }
      | null;
    return body?.candles ?? [];
  } catch {
    return [];
  }
}

export function RailExtras(props: Props) {
  const endpoints = useMemo(() => buildEndpoints(props), [props]);
  const [daily, setDaily] = useState<HistoricalCandle[]>([]);
  const [longTerm, setLongTerm] = useState<HistoricalCandle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDaily([]);
    setLongTerm([]);
    Promise.all([
      fetchCandles(endpoints.oneYear),
      fetchCandles(endpoints.fiveYear),
    ]).then(([oneY, fiveY]) => {
      if (cancelled) return;
      setDaily(oneY);
      setLongTerm(fiveY);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [endpoints.oneYear, endpoints.fiveYear]);

  return (
    <div className={cn("border-t", props.className)}>
      <Seasonals candles={longTerm} loading={loading} />
      <Technicals candles={daily} loading={loading} />
      <AtmIvTermStructure candles={daily} loading={loading} />
      <VolatilityCurve candles={daily} loading={loading} />
      <Profile />
    </div>
  );
}

/* ------------------------------------------------------------------------ *
 * Seasonals — per-year percent-change curves overlaid (last 3 years).
 * ------------------------------------------------------------------------ */

interface SeasonalsPoint {
  /** 0..365 — day-of-year, used to align years on the X axis. */
  doy: number;
  /** Year-keyed values: { "2024": 12.5, "2025": -3.2, "2026": 4.1 }. */
  [year: string]: number;
}

const SERIES_COLORS = ["hsl(212 89% 56%)", "hsl(150 60% 45%)", "hsl(28 88% 55%)"];

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / (24 * 60 * 60_000));
}

function buildSeasonals(candles: HistoricalCandle[]): {
  data: SeasonalsPoint[];
  years: number[];
} {
  if (candles.length === 0) return { data: [], years: [] };
  const byYear = new Map<number, { doy: number; close: number }[]>();
  for (const c of candles) {
    const d = new Date(c.date);
    if (!Number.isFinite(d.getTime())) continue;
    const y = d.getUTCFullYear();
    const list = byYear.get(y) ?? [];
    list.push({ doy: dayOfYear(d), close: c.close });
    byYear.set(y, list);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b).slice(-3);
  const seriesByYear = new Map<number, Map<number, number>>();
  for (const y of years) {
    const list = byYear.get(y) ?? [];
    list.sort((a, b) => a.doy - b.doy);
    const first = list[0]?.close ?? 0;
    const m = new Map<number, number>();
    if (first > 0) {
      for (const { doy, close } of list) {
        m.set(doy, ((close - first) / first) * 100);
      }
    }
    seriesByYear.set(y, m);
  }
  const allDoys = new Set<number>();
  for (const m of seriesByYear.values()) {
    for (const d of m.keys()) allDoys.add(d);
  }
  const sortedDoys = [...allDoys].sort((a, b) => a - b);
  const data: SeasonalsPoint[] = sortedDoys.map((doy) => {
    const row: SeasonalsPoint = { doy };
    for (const y of years) {
      const v = seriesByYear.get(y)?.get(doy);
      if (v != null) row[String(y)] = v;
    }
    return row;
  });
  return { data, years };
}

const MONTH_DOY = {
  Jan: 0,
  Jun: 151,
  Nov: 304,
};

function Seasonals({
  candles,
  loading,
}: {
  candles: HistoricalCandle[];
  loading: boolean;
}) {
  const { data, years } = useMemo(() => buildSeasonals(candles), [candles]);
  const hasData = data.length >= 5 && years.length >= 1;

  return (
    <section className="px-3 py-3">
      <h3 className="text-[13px] font-semibold text-foreground">Seasonals</h3>
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
                horizontal={false}
                verticalPoints={[]}
              />
              <XAxis
                dataKey="doy"
                type="number"
                domain={[0, 365]}
                ticks={[MONTH_DOY.Jan, MONTH_DOY.Jun, MONTH_DOY.Nov]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(doy: number) =>
                  doy <= 31 ? "Jan" : doy <= 200 ? "Jun" : "Nov"
                }
              />
              <YAxis hide domain={["auto", "auto"]} />
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
                labelFormatter={() => ""}
                formatter={(v: number, name: string) => [
                  `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
                  name,
                ]}
              />
              {years.map((y, i) => (
                <Line
                  key={y}
                  type="linear"
                  dataKey={String(y)}
                  stroke={SERIES_COLORS[(years.length - 1 - i) % SERIES_COLORS.length]}
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasData ? (
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          {years
            .slice()
            .reverse()
            .map((y, i) => (
              <span key={y} className="inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                />
                {y}
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------------ *
 * Technicals — semicircle gauge derived from price vs SMA20 + momentum.
 * ------------------------------------------------------------------------ */

type TechZone = "Strong sell" | "Sell" | "Neutral" | "Buy" | "Strong buy";

const ZONES: TechZone[] = ["Strong sell", "Sell", "Neutral", "Buy", "Strong buy"];

/** Returns a value in [-1, 1] from a closing-price series. */
function technicalsScore(closes: number[]): number | null {
  if (closes.length < 20) return null;
  const last = closes[closes.length - 1]!;
  const fiveAgo = closes[closes.length - 6]!;
  const window20 = closes.slice(-20);
  const sma20 = window20.reduce((a, b) => a + b, 0) / window20.length;
  // Combine trend (last vs SMA20) and momentum (5-day change) into [-1, 1].
  const trend = sma20 === 0 ? 0 : (last - sma20) / sma20;
  const mom = fiveAgo === 0 ? 0 : (last - fiveAgo) / fiveAgo;
  // Each component ±10% maps to ±1; clamp.
  const score = Math.max(-1, Math.min(1, (trend + mom) * 5));
  return score;
}

function scoreToZone(score: number | null): TechZone {
  if (score == null) return "Neutral";
  if (score <= -0.55) return "Strong sell";
  if (score <= -0.18) return "Sell";
  if (score >= 0.55) return "Strong buy";
  if (score >= 0.18) return "Buy";
  return "Neutral";
}

const ZONE_COLORS: Record<TechZone, string> = {
  "Strong sell": "hsl(0 80% 50%)",
  Sell: "hsl(2 75% 60%)",
  Neutral: "hsl(0 0% 75%)",
  Buy: "hsl(150 50% 55%)",
  "Strong buy": "hsl(150 60% 45%)",
};

const GAUGE_WIDTH = 260;
const GAUGE_HEIGHT = 140;
const GAUGE_CX = GAUGE_WIDTH / 2;
const GAUGE_CY = GAUGE_HEIGHT - 18;
const GAUGE_R_OUTER = 100;
const GAUGE_R_INNER = 78;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const a = polar(cx, cy, rOuter, startDeg);
  const b = polar(cx, cy, rOuter, endDeg);
  const c = polar(cx, cy, rInner, endDeg);
  const d = polar(cx, cy, rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${d.x} ${d.y}`,
    "Z",
  ].join(" ");
}

const ZONE_RANGES: Array<{ zone: TechZone; from: number; to: number }> = [
  { zone: "Strong sell", from: 0, to: 36 },
  { zone: "Sell", from: 36, to: 72 },
  { zone: "Neutral", from: 72, to: 108 },
  { zone: "Buy", from: 108, to: 144 },
  { zone: "Strong buy", from: 144, to: 180 },
];

function Technicals({
  candles,
  loading,
}: {
  candles: HistoricalCandle[];
  loading: boolean;
}) {
  const score = useMemo(
    () => technicalsScore(candles.map((c) => c.close)),
    [candles],
  );
  const zone = scoreToZone(score);
  // Map [-1, 1] → [0, 180] degrees for the needle.
  const needleDeg = score == null ? 90 : (score + 1) * 90;
  const needleEnd = polar(GAUGE_CX, GAUGE_CY, GAUGE_R_OUTER - 6, needleDeg);

  return (
    <section className="border-t px-3 py-3">
      <h3 className="text-[13px] font-semibold text-foreground">Technicals</h3>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="mx-auto h-[150px] w-[260px]" />
        ) : (
          <svg
            viewBox={`0 0 ${GAUGE_WIDTH} ${GAUGE_HEIGHT}`}
            className="mx-auto h-auto w-full max-w-[260px]"
            aria-hidden
          >
            {ZONE_RANGES.map(({ zone: z, from, to }) => {
              const active = z === zone;
              const color = active ? ZONE_COLORS[z] : "hsl(var(--muted))";
              return (
                <path
                  key={z}
                  d={arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R_OUTER, GAUGE_R_INNER, from, to)}
                  fill={color}
                  opacity={active ? 1 : 0.55}
                />
              );
            })}
            {ZONE_RANGES.map(({ zone: z, from, to }) => {
              const mid = (from + to) / 2;
              const labelR = GAUGE_R_OUTER + 14;
              const { x, y } = polar(GAUGE_CX, GAUGE_CY, labelR, mid);
              const lines = z.split(" ");
              return (
                <text
                  key={`label-${z}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground"
                  fontSize={9}
                >
                  {lines.map((ln, i) => (
                    <tspan key={i} x={x} dy={i === 0 ? 0 : 10}>
                      {ln}
                    </tspan>
                  ))}
                </text>
              );
            })}
            {/* Needle */}
            <line
              x1={GAUGE_CX}
              y1={GAUGE_CY}
              x2={needleEnd.x}
              y2={needleEnd.y}
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle
              cx={GAUGE_CX}
              cy={GAUGE_CY}
              r={4}
              fill="hsl(var(--foreground))"
            />
          </svg>
        )}
        <p className="mt-1 text-center text-[14px] font-semibold text-foreground">
          {zone}
        </p>
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            className="rounded-full border bg-card px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            More technicals
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ *
 * ATM IV term structure — realized vol per tenor as a stand-in for ATM IV.
 * ------------------------------------------------------------------------ */

const TENORS: Array<{ id: string; label: string; days: number }> = [
  { id: "1W", label: "1W", days: 5 },
  { id: "2W", label: "2W", days: 10 },
  { id: "1M", label: "1M", days: 21 },
  { id: "2M", label: "2M", days: 42 },
  { id: "3M", label: "3M", days: 63 },
  { id: "6M", label: "6M", days: 126 },
  { id: "9M", label: "9M", days: 189 },
  { id: "1Y", label: "1Y", days: 252 },
];

function realizedVolPct(closes: number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const a = slice[i - 1]!;
    const b = slice[i]!;
    if (a <= 0 || b <= 0) continue;
    rets.push(Math.log(b / a));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  return sd * Math.sqrt(252) * 100;
}

function AtmIvTermStructure({
  candles,
  loading,
}: {
  candles: HistoricalCandle[];
  loading: boolean;
}) {
  const data = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return TENORS.map((t) => ({
      tenor: t.label,
      iv: realizedVolPct(closes, t.days),
    })).filter((p): p is { tenor: string; iv: number } => p.iv != null);
  }, [candles]);
  const hasData = data.length >= 2;

  return (
    <section className="border-t px-3 py-3">
      <h3 className="text-[13px] font-semibold text-foreground">
        ATM IV term structure
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
                dataKey="tenor"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={32}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
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
                formatter={(v: number) => [`${v.toFixed(2)}%`, "ATM IV"]}
              />
              <Line
                type="linear"
                dataKey="iv"
                stroke="hsl(212 89% 56%)"
                strokeWidth={1.75}
                dot={{ r: 3, strokeWidth: 1, fill: "white", stroke: "hsl(212 89% 56%)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

