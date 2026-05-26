import { getNews } from "@/lib/market/news";
import type { Exchange } from "@/types/database";

import { NewsPanel } from "./news-panel";

interface Props {
  symbol: string;
  exchange: Exchange;
  /** Company display name, used to anchor the news query on the issuer. */
  name?: string | null;
}

/**
 * Server entry point for the News tab. Does the initial "all" category
 * fetch on the server so the first paint already has 30 headlines, then
 * hands off to <NewsPanel> which owns category filter state and re-fetches
 * via a server action when the user picks a different filter.
 */
export async function NewsSection({ symbol, exchange, name }: Props) {
  const initial = await getNews(symbol, exchange, name, "all");
  return (
    <NewsPanel
      symbol={symbol}
      exchange={exchange}
      name={name ?? null}
      initialItems={initial}
    />
  );
}
