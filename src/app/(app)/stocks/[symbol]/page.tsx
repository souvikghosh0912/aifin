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
import { getHistorical } from "@/lib/market/historical";
import { getMetaInfo } from "@/lib/market/meta";
import { getQuote } from "@/lib/market/nse";
import { computeSignal } from "@/lib/market/signal";
import { parseExchange } from "@/lib/market/symbols";
import type { MetaInfo, Quote } from "@/lib/market/types";
import type { Exchange } from "@/types/database";
import { cn, formatINR, formatNumber } from "@/lib/utils";

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
      <section id="key-stats" className="scroll-mt-20 space-y-2">
        <SectionHeading>Key stats</SectionHeading>
        <KeyStatsGrid quote={quote} meta={meta} />
      </section>
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

async function ChartPanel({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: Exchange;
}) {
  const candles = await getHistorical(symbol, exchange, "3M");
  return <TimeframeChart initial={candles} symbol={symbol} exchange={exchange} />;
}

function KeyStatsGrid({ quote, meta }: { quote: Quote; meta: MetaInfo }) {
  const items = [
    { label: "Open", value: fmtPrice(quote.open) },
    { label: "Day high", value: fmtPrice(quote.dayHigh) },
    { label: "Day low", value: fmtPrice(quote.dayLow) },
    { label: "Prev close", value: fmtPrice(quote.previousClose) },
    {
      label: "Volume",
      value: quote.volume == null ? "—" : formatNumber(Math.round(quote.volume)),
    },
    {
      label: "Mkt cap",
      value:
        meta.marketCap == null
          ? "—"
          : formatINR(meta.marketCap, { compact: true }),
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="bg-card px-3 py-2.5">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {it.label}
          </dt>
          <dd className="num mt-1 text-sm font-semibold tabular-nums">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
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

function fmtPrice(v: number | null): string {
  return v == null ? "—" : formatINR(v);
}
