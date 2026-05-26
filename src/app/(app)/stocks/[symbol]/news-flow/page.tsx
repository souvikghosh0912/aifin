import { Suspense } from "react";

import { NewsFlowShell } from "@/components/news-flow/news-flow-shell";
import { KeyDetailsPanel } from "@/components/stocks/key-details-panel";
import { RailResizable } from "@/components/stocks/rail-resizable";
import { SidebarToggle } from "@/components/stocks/sidebar-toggle";
import { TopGainersList } from "@/components/stocks/top-gainers-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getMetaInfo } from "@/lib/market/meta";
import { getNews, type CategoryId } from "@/lib/market/news";
import { getQuote } from "@/lib/market/nse";
import { parseExchange } from "@/lib/market/symbols";

export const dynamic = "force-dynamic";

const ALL_CATEGORIES: readonly CategoryId[] = [
  "all",
  "key-facts",
  "earnings",
  "earnings-calls",
  "dividends",
  "strategy",
  "mergers",
  "management",
  "esg",
  "analysts",
];

function parseCategory(raw: string | undefined): CategoryId {
  return raw && (ALL_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as CategoryId)
    : "all";
}

interface PageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ exchange?: string; category?: string }>;
}

export default async function NewsFlowPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const sp = await searchParams;
  const exchange = parseExchange(sp.exchange);
  const category = parseCategory(sp.category);

  const [quote, meta] = await Promise.all([
    getQuote(symbol, exchange),
    getMetaInfo(symbol, exchange),
  ]);

  const name = meta.name ?? quote.name ?? null;
  const items = await getNews(symbol, exchange, name, category);

  const topSection = (
    <Suspense fallback={<Skeleton className="w-full flex-1" />}>
      <TopGainersList activeSymbol={quote.symbol} />
    </Suspense>
  );
  const bottomSection = (
    <Suspense fallback={<Skeleton className="w-full flex-1" />}>
      <KeyDetailsPanel
        symbol={symbol}
        exchange={exchange}
        quote={quote}
        meta={meta}
      />
    </Suspense>
  );
  const mobileRail = (
    <div className="md:hidden">
      <SidebarToggle>
        {topSection}
        {bottomSection}
      </SidebarToggle>
    </div>
  );

  return (
    <RailResizable
      storageKey="rail:stocks"
      mobileRail={mobileRail}
      top={topSection}
      bottom={bottomSection}
    >
      <NewsFlowShell
        symbol={symbol}
        exchange={exchange}
        name={name}
        initialCategory={category}
        initialItems={items}
      />
    </RailResizable>
  );
}
