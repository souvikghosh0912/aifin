import type { NewsItem } from "@/lib/market/news";

/**
 * Returns the unique publisher names visible in `items`, sorted
 * alphabetically (case-insensitive locale compare). Trims whitespace
 * before comparing and de-duplicates case-insensitively while
 * preserving the first-seen display casing. Items without a publisher
 * are skipped.
 */
export function uniquePublishers(items: NewsItem[]): string[] {
  const seen = new Map<string, string>();
  for (const it of items) {
    const raw = it.publisher;
    if (raw == null) continue;
    const display = raw.trim();
    if (display.length === 0) continue;
    const key = display.toLowerCase();
    if (!seen.has(key)) seen.set(key, display);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/**
 * Filter items to publishers whose lowercased name is in `selected`.
 * Empty selection passes everything through. Items with a null
 * publisher are filtered out when selection is non-empty.
 */
export function applyProvider(
  items: NewsItem[],
  selected: Set<string>,
): NewsItem[] {
  if (selected.size === 0) return items;
  return items.filter(
    (it) =>
      it.publisher != null &&
      selected.has(it.publisher.trim().toLowerCase()),
  );
}
