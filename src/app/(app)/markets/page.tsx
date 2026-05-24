import { ChevronDown } from "lucide-react";
import { Suspense } from "react";

import {
  MarketsSection,
  type MarketsCardData,
} from "@/components/markets/markets-section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMarketHistorical,
  fetchMarketQuotes,
  getMarketIndices,
  getMarketStocks,
  type MarketEntry,
} from "@/lib/market/markets";
import type { HistoricalCandle, Range } from "@/lib/market/types";

export const dynamic = "force-dynamic";

const DEFAULT_RANGE: Range = "1M";

export default function MarketsPage() {
  return (
    <div className="space-y-10 pb-12">
      <div className="text-center">
        <h1 className="inline-flex items-center gap-2 text-3xl font-bold tracking-tight md:text-4xl">
          Markets, everywhere
          <ChevronDown
            className="h-6 w-6 text-muted-foreground"
            strokeWidth={2.25}
            aria-hidden
          />
        </h1>
      </div>

      <Suspense fallback={<SectionFallback />}>
        <IndicesBlock />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <StocksBlock />
      </Suspense>
    </div>
  );
}

function SectionFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-[360px] w-full" />
    </div>
  );
}

async function buildSectionData(entries: MarketEntry[]): Promise<{
  cards: MarketsCardData[];
  initialCandles: HistoricalCandle[];
}> {
  const [quotes, initialCandles] = await Promise.all([
    fetchMarketQuotes(entries).catch(() => []),
    entries[0]
      ? fetchMarketHistorical(entries[0], DEFAULT_RANGE).catch(
          () => [] as HistoricalCandle[],
        )
      : Promise.resolve([] as HistoricalCandle[]),
  ]);
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const cards: MarketsCardData[] = entries.map((e) => {
    const q = byId.get(e.id);
    return {
      id: e.id,
      name: e.name,
      shortName: e.shortName,
      kind: e.kind,
      lastPrice: q?.lastPrice ?? null,
      change: q?.change ?? null,
      changePct: q?.changePct ?? null,
    };
  });
  return { cards, initialCandles };
}

async function IndicesBlock() {
  const entries = getMarketIndices();
  const { cards, initialCandles } = await buildSectionData(entries);
  return (
    <MarketsSection
      title="Indices"
      items={cards}
      initialCandles={initialCandles}
      initialRange={DEFAULT_RANGE}
    />
  );
}

async function StocksBlock() {
  const entries = getMarketStocks();
  const { cards, initialCandles } = await buildSectionData(entries);
  return (
    <MarketsSection
      title="Indian stocks"
      titleAccent={<span aria-label="India">🇮🇳</span>}
      items={cards}
      initialCandles={initialCandles}
      initialRange={DEFAULT_RANGE}
    />
  );
}
