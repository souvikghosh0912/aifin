import { ChevronRight } from "lucide-react";
import { Suspense } from "react";

import { KeyDetailsPanel } from "@/components/stocks/key-details-panel";
import { SidebarSearch } from "@/components/stocks/sidebar-search";
import { SidebarToggle } from "@/components/stocks/sidebar-toggle";
import { SignalBadge } from "@/components/stocks/signal-badge";
import { StockHeader } from "@/components/stocks/stock-header";
import { StockTabs } from "@/components/stocks/stock-tabs";
import { TimeframeChart } from "@/components/stocks/timeframe-chart";
import { TopGainersList } from "@/components/stocks/top-gainers-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getFundamentals } from "@/lib/market/fundamentals";
import { getHistorical } from "@/lib/market/historical";
import { getMetaInfo } from "@/lib/market/meta";
import { getQuote } from "@/lib/market/nse";
import { computeSignal } from "@/lib/market/signal";
import { parseExchange } from "@/lib/market/symbols";
import type { Fundamentals, LatestEarnings, MetaInfo } from "@/lib/market/types";
import type { Exchange } from "@/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ exchange?: string }>;
}

export default async function StockPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const exchange = parseExchange((await searchParams).exchange);
  const [quote, meta] = await Promise.all([
    getQuote(symbol, exchange),
    getMetaInfo(symbol, exchange),
  ]);

  const Rail = (
    <>
      <SidebarSearch />
      <Suspense fallback={<Skeleton className="w-full flex-1" />}>
        <TopGainersList activeSymbol={quote.symbol} />
      </Suspense>
      <Suspense fallback={<Skeleton className="w-full flex-1" />}>
        <KeyDetailsPanel
          symbol={symbol}
          exchange={exchange}
          quote={quote}
          meta={meta}
        />
      </Suspense>
    </>
  );

  return (
    <div className="space-y-4 md:pr-[320px]">
      <div className="md:hidden">
        <SidebarToggle>{Rail}</SidebarToggle>
      </div>
      <StockHeader quote={quote} meta={meta} />
      <StockTabs />
      <section id="overview" className="scroll-mt-20 space-y-4">
        <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
          <ChartPanel symbol={symbol} exchange={exchange} />
        </Suspense>
      </section>
      <Suspense fallback={<FundamentalsFallback />}>
        <FundamentalsSections symbol={symbol} exchange={exchange} meta={meta} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <TechnicalsSection symbol={symbol} exchange={exchange} />
      </Suspense>
      <aside className="hidden md:fixed md:bottom-0 md:right-0 md:top-12 md:z-20 md:flex md:w-[320px] md:flex-col md:gap-2 md:overflow-hidden md:border-l md:bg-background md:py-8 md:pl-5 md:pr-6">
        {Rail}
      </aside>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-0.5 text-2xl font-extrabold tracking-tight text-foreground">
      <span>{children}</span>
      <ChevronRight
        className="h-6 w-6 -translate-y-px text-foreground"
        strokeWidth={2.5}
        aria-hidden
      />
    </h2>
  );
}

async function ChartPanel({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: Exchange;
}) {
  const candles = await getHistorical(symbol, exchange, "1Y");
  return <TimeframeChart initial={candles} />;
}

async function FundamentalsSections({
  symbol,
  exchange,
  meta,
}: {
  symbol: string;
  exchange: Exchange;
  meta: MetaInfo;
}) {
  const fundamentals = await getFundamentals(symbol, exchange);
  return (
    <>
      <section
        id="latest-earnings"
        className="scroll-mt-20 space-y-5 pt-2"
      >
        <SectionTitle>Latest earnings</SectionTitle>
        <LatestEarningsGrid earnings={fundamentals.earnings} />
      </section>
      <section id="key-stats" className="scroll-mt-20 space-y-5 pt-2">
        <SectionTitle>Key stats</SectionTitle>
        <KeyStatsGrid fundamentals={fundamentals} meta={meta} />
      </section>
    </>
  );
}

function FundamentalsFallback() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}

interface StatCellDef {
  label: string;
  value: string;
  /** Tiny suffix (e.g. "INR") rendered after the value in small caps. */
  suffix?: string | null;
  /** Whether to render a chevron after the label (decorative). */
  hasChevron?: boolean;
}

function LatestEarningsGrid({ earnings }: { earnings: LatestEarnings | null }) {
  const items: StatCellDef[] = [
    {
      label: "Last report date",
      value: formatReportDate(earnings?.reportDate ?? null),
    },
    {
      label: "Report period",
      value: earnings?.period ?? "—",
    },
    {
      label: "EPS",
      ...numberCell(earnings?.eps ?? null, { decimals: 2, suffix: "INR" }),
    },
    {
      label: "Revenue",
      ...compactCell(earnings?.revenue ?? null, { suffix: "INR" }),
    },
  ];
  return <StatGrid items={items} />;
}

function KeyStatsGrid({
  fundamentals,
  meta,
}: {
  fundamentals: Fundamentals;
  meta: MetaInfo;
}) {
  // Yahoo's marketCap occasionally lags behind the NSE feed; prefer whichever
  // we have, falling back to the meta payload the rail already uses.
  const marketCap = fundamentals.marketCap ?? meta.marketCap;

  const items: StatCellDef[] = [
    {
      label: "Market capitalization",
      ...compactCell(marketCap, { suffix: "INR" }),
    },
    {
      label: "Dividend yield (indicated)",
      hasChevron: true,
      ...percentCell(fundamentals.dividendYieldPct),
    },
    {
      label: "Price to earnings Ratio (TTM)",
      hasChevron: true,
      ...numberCell(fundamentals.trailingPE, { decimals: 2 }),
    },
    {
      label: "Basic EPS (TTM)",
      hasChevron: true,
      ...numberCell(fundamentals.basicEpsTTM, { decimals: 2, suffix: "INR" }),
    },
    {
      label: "Net income (FY)",
      hasChevron: true,
      ...compactCell(fundamentals.netIncomeFY, { suffix: "INR" }),
    },
    {
      label: "Revenue (FY)",
      hasChevron: true,
      ...compactCell(fundamentals.revenueFY, { suffix: "INR" }),
    },
    {
      label: "Shares float",
      hasChevron: true,
      ...compactCell(fundamentals.floatShares, {}),
    },
    {
      label: "Beta (1Y)",
      ...numberCell(fundamentals.beta, { decimals: 2 }),
    },
  ];
  return <StatGrid items={items} />;
}

function StatGrid({ items }: { items: StatCellDef[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <StatCell key={it.label} cell={it} />
      ))}
    </dl>
  );
}

function StatCell({ cell }: { cell: StatCellDef }) {
  const missing = cell.value === "—";
  return (
    <div className="flex flex-col">
      <dt className="flex items-center gap-0.5 text-[13px] font-semibold text-foreground">
        <span>{cell.label}</span>
        {cell.hasChevron ? (
          <ChevronRight
            className="h-3.5 w-3.5 text-foreground"
            strokeWidth={2.5}
            aria-hidden
          />
        ) : null}
      </dt>
      <dd
        className={cn(
          "num mt-1 flex items-baseline gap-1.5 text-[17px] font-normal tabular-nums leading-tight",
          missing && "text-muted-foreground",
        )}
      >
        <span>{cell.value}</span>
        {cell.suffix && !missing ? (
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {cell.suffix}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

const REPORT_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatReportDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? REPORT_DATE_FMT.format(d) : "—";
}

function compactCell(
  value: number | null,
  opts: { suffix?: string | null },
): { value: string; suffix?: string | null } {
  if (value == null || !Number.isFinite(value)) {
    return { value: "—" };
  }
  const abs = Math.abs(value);
  let display: string;
  if (abs >= 1e12) display = `${(value / 1e12).toFixed(2)} T`;
  else if (abs >= 1e9) display = `${(value / 1e9).toFixed(2)} B`;
  else if (abs >= 1e6) display = `${(value / 1e6).toFixed(2)} M`;
  else if (abs >= 1e3) display = `${(value / 1e3).toFixed(2)} K`;
  else display = value.toFixed(2);
  return { value: display, suffix: opts.suffix ?? null };
}

function numberCell(
  value: number | null,
  opts: { decimals?: number; suffix?: string | null },
): { value: string; suffix?: string | null } {
  if (value == null || !Number.isFinite(value)) {
    return { value: "—" };
  }
  return {
    value: value.toFixed(opts.decimals ?? 2),
    suffix: opts.suffix ?? null,
  };
}

function percentCell(
  value: number | null,
): { value: string; suffix?: string | null } {
  if (value == null || !Number.isFinite(value)) {
    return { value: "—" };
  }
  return { value: `${value.toFixed(2)} %` };
}

async function TechnicalsSection({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: Exchange;
}) {
  const candles = await getHistorical(symbol, exchange, "3M");
  const closes = candles.map((c) => c.close);
  const signal = computeSignal(closes);
  // Simple momentum readouts the user can sanity-check against the chart.
  const ret = (window: number) => {
    if (closes.length < window + 1) return null;
    const a = closes[closes.length - 1 - window]!;
    const b = closes[closes.length - 1]!;
    return ((b - a) / a) * 100;
  };
  const r5 = ret(5);
  const r20 = ret(20);
  const r60 = ret(60);

  return (
    <section id="technicals" className="scroll-mt-20 space-y-2">
      <SectionHeading>Technicals</SectionHeading>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Signal · 3M close
            </p>
            <p className="text-sm font-semibold">
              {signal === "BUY"
                ? "Bullish momentum"
                : signal === "SELL"
                  ? "Bearish momentum"
                  : "No clear trend"}
            </p>
          </div>
          <SignalBadge value={signal} />
        </div>
        <dl className="grid grid-cols-3 gap-px bg-border">
          <ReturnCell label="5d" value={r5} />
          <ReturnCell label="20d" value={r20} />
          <ReturnCell label="60d" value={r60} />
        </dl>
      </div>
    </section>
  );
}

function ReturnCell({ label, value }: { label: string; value: number | null }) {
  const up = (value ?? 0) >= 0;
  return (
    <div className="bg-card px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label} return
      </dt>
      <dd
        className={cn(
          "num mt-1 text-sm font-semibold tabular-nums",
          value == null
            ? "text-muted-foreground"
            : up
              ? "text-success"
              : "text-destructive",
        )}
      >
        {value == null
          ? "—"
          : `${up ? "+" : ""}${value.toFixed(2)}%`}
      </dd>
    </div>
  );
}
