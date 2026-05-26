import "server-only";

import type { Exchange } from "@/types/database";

import { normalizeSymbol } from "./symbols";
import { MarketDataError } from "./types";

/**
 * Per-ticker news via Google News RSS search.
 *
 * We send the company name (or ticker as fallback) as a query and let
 * Google's keyword index do the matching. This handles brand-name
 * aliases ("Airtel" vs "Bharti Airtel", "Maruti" vs "Maruti Suzuki
 * India", "Kotak" vs "Kotak Mahindra Bank") that the previous
 * publisher-feed + substring-match approach missed for almost every
 * stock outside the top ten.
 *
 * The article reader (article.ts) resolves Google's /rss/articles/<id>
 * URLs via Jina Reader, with a batchexecute RPC fallback for when Jina
 * rate-limits, so the News Flow reader still extracts publisher bodies.
 */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/rss+xml,application/xml,text/xml,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_ITEMS = 30;

export type CategoryId =
  | "all"
  | "key-facts"
  | "earnings"
  | "earnings-calls"
  | "dividends"
  | "strategy"
  | "mergers"
  | "management"
  | "esg"
  | "analysts";

export interface NewsItem {
  id: string;
  title: string;
  publisher: string | null;
  publishedAt: string;
  link: string;
  /** Article hero/thumb URL when the feed exposes one, else null. */
  thumbnail: string | null;
  relatedTickers: string[];
}

interface RawItem {
  title: string;
  link: string;
  pubDate: string;
  description: string | null;
  thumbnail: string | null;
  publisher: string | null;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) {
      throw new MarketDataError(`Feed ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    if ((err as { name?: string })?.name === "AbortError") {
      throw new MarketDataError(`Feed timed out after ${TIMEOUT_MS}ms`);
    }
    throw new MarketDataError("Feed request failed", err);
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractTag(xml: string, tag: string): string | null {
  const cdataRe = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`,
  );
  const cdata = cdataRe.exec(xml);
  if (cdata) return cdata[1] ?? null;
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const plain = plainRe.exec(xml);
  return plain ? plain[1] ?? null : null;
}

// Google News RSS uses <source url="...">Publisher</source> per item.
function extractPublisher(body: string): string | null {
  const src = /<source\b[^>]*>([\s\S]*?)<\/source>/i.exec(body);
  if (!src?.[1]) return null;
  const name = stripHtml(decodeEntities(src[1])).trim();
  return name.length > 0 ? name : null;
}

// Google News appends " - Publisher" to every headline. Strip it so the
// publisher column doesn't render the same text twice.
function stripTitleSuffix(title: string, publisher: string | null): string {
  if (!publisher) return title;
  const tail = ` - ${publisher}`;
  return title.endsWith(tail) ? title.slice(0, -tail.length) : title;
}

function parseRss(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const body = m[1] ?? "";
    const title = extractTag(body, "title");
    const link = extractTag(body, "link");
    const pubDate = extractTag(body, "pubDate");
    const descriptionRaw = extractTag(body, "description");
    if (!title || !link || !pubDate) continue;
    const publisher = extractPublisher(body);
    const description = descriptionRaw
      ? stripHtml(decodeEntities(descriptionRaw))
      : null;
    items.push({
      title: stripTitleSuffix(decodeEntities(title).trim(), publisher),
      link: decodeEntities(link).trim(),
      pubDate: pubDate.trim(),
      description,
      thumbnail: null,
      publisher,
    });
  }
  return items;
}

interface CacheEntry {
  items: RawItem[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<RawItem[]>>();

function searchUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
}

const SUFFIX_RE =
  /\s+(Ltd|Limited|Inc|Corp|Corporation|Pvt|Private|Plc|Company|Co|Group|Industries|Industrial)\.?$/i;

function buildQuery(symbol: string, name: string | null | undefined): string {
  if (name) {
    const trimmed = name.replace(SUFFIX_RE, "").trim();
    if (trimmed.length >= 3) return trimmed;
  }
  return symbol;
}

/**
 * Fetch headlines for one query. Cached 5 min, single inflight per
 * query key so the news tab and news-flow page don't fan out twice.
 */
async function fetchSearchFeed(query: string): Promise<RawItem[]> {
  const hit = cache.get(query);
  if (hit && hit.expiresAt > Date.now()) return hit.items;
  const existing = inflight.get(query);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const xml = await fetchText(searchUrl(query));
      const items = parseRss(xml);
      cache.set(query, { items, expiresAt: Date.now() + CACHE_TTL_MS });
      return items;
    } finally {
      inflight.delete(query);
    }
  })();

  inflight.set(query, promise);
  return promise;
}

// Keyword patterns used to narrow the headlines list to a category
// filter. Tuned for Indian-market reporting (YoY/QoQ, MD/chairman
// titles, SEBI, etc.).
const CATEGORY_PATTERNS: Record<CategoryId, RegExp | null> = {
  all: null,
  "key-facts": null,
  earnings:
    /\b(earning|results?|profit|net income|revenue|quarter|Q[1-4]|YoY|FY\d{2})\b/i,
  "earnings-calls": /\b(earnings call|conference call|investor call|concall)\b/i,
  dividends: /\bdividend\b/i,
  strategy:
    /\b(strategy|expansion|launch|partnership|tie[- ]up|joint venture|JV|new\s+product)\b/i,
  mergers:
    /\b(merger|acquisition|acquir|takeover|buyout|divest|stake sale|sells?\s+stake)\b/i,
  management:
    /\b(CEO|CFO|MD|managing director|chairperson|chairman|chairwoman|appoints?|steps?\s+down|resigns?)\b/i,
  esg:
    /\b(ESG|sustainab|carbon|emission|climate|governance|compliance|regulation|SEBI)\b/i,
  analysts:
    /\b(analyst|brokerage|rating|target\s+price|upgrade|downgrade|recommend|buy\s+call|sell\s+call)\b/i,
};

/**
 * Fetch up to 30 recent headlines for a ticker, optionally filtered to
 * a news category. Per-query feed is cached 5 min; category filter runs
 * in-process. Returns [] when the feed fails or nothing matches so the
 * news section degrades silently.
 */
export async function getNews(
  symbol: string,
  exchange: Exchange,
  name?: string | null,
  category: CategoryId = "all",
): Promise<NewsItem[]> {
  void exchange;
  const bare = normalizeSymbol(symbol);
  if (!bare) return [];

  const query = buildQuery(bare, name);

  let items: RawItem[];
  try {
    items = await fetchSearchFeed(query);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[news] search feed failed", err);
    }
    return [];
  }

  const pattern = CATEGORY_PATTERNS[category];
  const filtered = pattern
    ? items.filter(
        (it) =>
          pattern.test(it.title) ||
          (it.description != null && pattern.test(it.description)),
      )
    : items;

  const out: NewsItem[] = [];
  for (const r of filtered) {
    const ts = Date.parse(r.pubDate);
    if (!Number.isFinite(ts)) continue;
    const baseTitle = r.title;
    const title =
      category === "key-facts" ? `Key Fact : ${baseTitle}` : baseTitle;
    out.push({
      id: r.link,
      title,
      publisher: r.publisher,
      publishedAt: new Date(ts).toISOString(),
      link: r.link,
      thumbnail: r.thumbnail,
      relatedTickers: [bare],
    });
    if (out.length >= MAX_ITEMS) break;
  }

  return out;
}
