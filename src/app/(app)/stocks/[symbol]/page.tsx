import { Suspense } from "react";

import { KeyDetailsPanel } from "@/components/stocks/key-details-panel";
import { SidebarSearch } from "@/components/stocks/sidebar-search";
import { SidebarToggle } from "@/components/stocks/sidebar-toggle";
import { StockHeader } from "@/components/stocks/stock-header";
import { TimeframeChart } from "@/components/stocks/timeframe-chart";
import { TopGainersList } from "@/components/stocks/top-gainers-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getHistorical } from "@/lib/market/historical";
import { getMetaInfo } from "@/lib/market/meta";
import { getQuote } from "@/lib/market/nse";
import { parseExchange } from "@/lib/market/symbols";
import type { Exchange } from "@/types/database";

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
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TopGainersList activeSymbol={quote.symbol} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
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
    <div className="space-y-4">
      <div className="md:hidden">
        <SidebarToggle>{Rail}</SidebarToggle>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-3">
          <StockHeader quote={quote} meta={meta} />
          <Suspense fallback={<Skeleton className="h-80 w-full" />}>
            <ChartPanel symbol={symbol} exchange={exchange} />
          </Suspense>
        </div>
        <aside className="hidden md:flex md:flex-col md:gap-3">{Rail}</aside>
      </div>
    </div>
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
