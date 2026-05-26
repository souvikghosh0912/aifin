"use client";

import { useState, type ReactNode } from "react";

import {
  MarketsSection,
  type MarketsCardData,
} from "@/components/markets/markets-section";
import { MarketsRailPanel } from "@/components/markets/markets-rail-panel";
import { RailResizable } from "@/components/stocks/rail-resizable";
import { SidebarToggle } from "@/components/stocks/sidebar-toggle";
import type { MarketQuoteSnapshot } from "@/lib/market/markets";
import type { MarketEntry } from "@/lib/market/markets-catalog";
import type { HistoricalCandle, MarketsRange } from "@/lib/market/types";

interface Props {
  indicesCards: MarketsCardData[];
  indicesInitialCandles: HistoricalCandle[];
  stocksCards: MarketsCardData[];
  stocksInitialCandles: HistoricalCandle[];
  allEntries: MarketEntry[];
  allQuotes: MarketQuoteSnapshot[];
  initialRange: MarketsRange;
  /** Server-rendered TopGainersList passed through as a slot. */
  topGainersSlot: ReactNode;
}

/**
 * Client orchestration for the /markets page. Owns the rail-selection state
 * shared between the two MarketsSection carousels and the right-rail details
 * panel. TopGainersList stays server-rendered and is passed in as a slot.
 */
export function MarketsView({
  indicesCards,
  indicesInitialCandles,
  stocksCards,
  stocksInitialCandles,
  allEntries,
  allQuotes,
  initialRange,
  topGainersSlot,
}: Props) {
  const [railEntryId, setRailEntryId] = useState<string>(
    allEntries[0]?.id ?? "",
  );

  const topSection = topGainersSlot;
  const bottomSection = (
    <MarketsRailPanel
      entries={allEntries}
      initialQuotes={allQuotes}
      selectedEntryId={railEntryId}
    />
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
      storageKey="rail:markets"
      className="space-y-10 pb-12"
      mobileRail={mobileRail}
      top={topSection}
      bottom={bottomSection}
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Markets, India
        </h1>
      </div>

      <MarketsSection
        title="Indices"
        items={indicesCards}
        initialCandles={indicesInitialCandles}
        initialRange={initialRange}
        onCardClick={setRailEntryId}
      />
      <MarketsSection
        title="Indian stocks"
        titleAccent={<span aria-label="India">🇮🇳</span>}
        items={stocksCards}
        initialCandles={stocksInitialCandles}
        initialRange={initialRange}
        onCardClick={setRailEntryId}
      />
    </RailResizable>
  );
}
