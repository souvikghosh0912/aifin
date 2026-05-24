import { Suspense } from "react";

import { type MarketsCardData } from "@/components/markets/markets-section";
import { MarketsView } from "@/components/markets/markets-view";
import { TopGainersList } from "@/components/stocks/top-gainers-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMarketHistorical,
  fetchMarketQuotes,
  getMarketIndices,
  getMarketStocks,
  type MarketEntry,
} from "@/lib/market/markets";
import type { HistoricalCandle, MarketsRange } from "@/lib/market/types";

export const dynamic = "force-dynamic";

const DEFAULT_RANGE: MarketsRange = "1M";

export default async function MarketsPage() {
  const indices = getMarketIndices();
  const stocks = getMarketStocks();
  const allEntries: MarketEntry[] = [...indices, ...stocks];

  const [allQuotes, indicesInitialCandles, stocksInitialCandles] =
    await Promise.all([
      fetchMarketQuotes(allEntries).catch(() => []),
      indices[0]
        ? fetchMarketHistorical(indices[0], DEFAULT_RANGE).catch(
            () => [] as HistoricalCandle[],
          )
        : Promise.resolve([] as HistoricalCandle[]),
      stocks[0]
        ? fetchMarketHistorical(stocks[0], DEFAULT_RANGE).catch(
            () => [] as HistoricalCandle[],
          )
        : Promise.resolve([] as HistoricalCandle[]),
    ]);

  const quoteById = new Map(allQuotes.map((q) => [q.id, q]));
  const toCard = (e: MarketEntry): MarketsCardData => {
    const q = quoteById.get(e.id);
    return {
      id: e.id,
      name: e.name,
      shortName: e.shortName,
      kind: e.kind,
      lastPrice: q?.lastPrice ?? null,
      change: q?.change ?? null,
      changePct: q?.changePct ?? null,
    };
  };

  return (
    <MarketsView
      indicesCards={indices.map(toCard)}
      indicesInitialCandles={indicesInitialCandles}
      stocksCards={stocks.map(toCard)}
      stocksInitialCandles={stocksInitialCandles}
      allEntries={allEntries}
      allQuotes={allQuotes}
      initialRange={DEFAULT_RANGE}
      topGainersSlot={
        <Suspense key="top-gainers" fallback={<Skeleton className="w-full flex-1" />}>
          <TopGainersList activeSymbol="" />
        </Suspense>
      }
    />
  );
}
