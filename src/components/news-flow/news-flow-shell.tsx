"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { fetchNewsByCategory } from "@/components/stocks/news-actions";
import type { CategoryId, NewsItem } from "@/lib/market/news";
import type { Exchange } from "@/types/database";

import { applyFormat, FORMAT_EMPTY, type FormatState } from "./format-state";
import { NewsFlowFilterBar } from "./news-flow-filter-bar";
import { NewsFlowHeader } from "./news-flow-header";
import { NewsFlowList } from "./news-flow-list";
import { NewsFlowReader } from "./news-flow-reader";
import { applyProvider, uniquePublishers } from "./provider-data";
import { applySector, type SectorId } from "./sector-data";

interface Props {
  symbol: string;
  exchange: Exchange;
  name: string | null;
  initialCategory: CategoryId;
  initialItems: NewsItem[];
}

export function NewsFlowShell({
  symbol,
  exchange,
  name,
  initialCategory,
  initialItems,
}: Props) {
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItems[0]?.id ?? null,
  );
  const [format, setFormat] = useState<FormatState>(FORMAT_EMPTY);
  const [sectors, setSectors] = useState<Set<SectorId>>(() => new Set());
  const [providers, setProviders] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const latestRef = useRef<CategoryId>(initialCategory);

  // Pipeline: format narrows first, sector second; provider third so
  // its option list (computed from itemsAfterFormat below) stays
  // stable while the user toggles sectors.
  const itemsAfterFormat = useMemo(
    () => applyFormat(items, format),
    [items, format],
  );
  const providerOptions = useMemo(
    () => uniquePublishers(itemsAfterFormat),
    [itemsAfterFormat],
  );
  const displayedItems = useMemo(() => {
    const afterSector = applySector(itemsAfterFormat, sectors);
    return applyProvider(afterSector, providers);
  }, [itemsAfterFormat, sectors, providers]);

  const selected =
    displayedItems.find((i) => i.id === selectedId) ?? displayedItems[0] ?? null;

  const onCategoryChange = (next: CategoryId) => {
    if (next === category) return;
    setCategory(next);
    latestRef.current = next;
    startTransition(async () => {
      try {
        const fetched = await fetchNewsByCategory({
          symbol,
          exchange,
          name,
          category: next,
        });
        if (latestRef.current !== next) return;
        setItems(fetched);
        setSelectedId(fetched[0]?.id ?? null);
      } catch {
        if (latestRef.current !== next) return;
        setItems([]);
        setSelectedId(null);
      }
    });
  };

  const onResetAll = () => {
    setFormat(FORMAT_EMPTY);
    setSectors(new Set());
    setProviders(new Set());
    if (category !== "all") onCategoryChange("all");
  };

  return (
    <div className="flex h-[calc(100dvh+2rem)] min-h-0 flex-col">
      <NewsFlowHeader symbol={symbol} name={name} category={category} />
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(360px,1fr)_minmax(420px,1.4fr)] gap-4">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <NewsFlowFilterBar
            symbol={symbol}
            category={category}
            onCategoryChange={onCategoryChange}
            format={format}
            onFormatChange={setFormat}
            sectors={sectors}
            onSectorsChange={setSectors}
            providers={providers}
            providerOptions={providerOptions}
            onProvidersChange={setProviders}
            onResetAll={onResetAll}
            disabled={pending}
          />
          <NewsFlowList
            items={displayedItems}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            loading={pending}
            flash={format.flash}
          />
        </div>
        <NewsFlowReader item={selected} flash={format.flash} />
      </div>
    </div>
  );
}
