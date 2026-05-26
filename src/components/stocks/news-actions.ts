"use server";

import { getArticle, type Article } from "@/lib/market/article";
import { getNews, type CategoryId, type NewsItem } from "@/lib/market/news";
import type { Exchange } from "@/types/database";

/**
 * Server action used by the client news panel to refresh the headline list
 * when the user picks a different category filter. Thin wrapper around
 * getNews so the caching + Google News fetch logic lives in one place.
 */
export async function fetchNewsByCategory(args: {
  symbol: string;
  exchange: Exchange;
  name: string | null;
  category: CategoryId;
}): Promise<NewsItem[]> {
  return getNews(args.symbol, args.exchange, args.name, args.category);
}

/**
 * Server action that resolves the Google News redirect for a headline and
 * extracts the publisher's article body (Mozilla Readability under the
 * hood). Returns null when the publisher blocks scraping or paywalls the
 * body — the reader UI then falls back to an external CTA.
 */
export async function fetchArticle(url: string): Promise<Article | null> {
  return getArticle(url);
}
