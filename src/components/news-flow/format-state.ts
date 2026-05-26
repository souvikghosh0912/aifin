import type { NewsItem } from "@/lib/market/news";

/**
 * Tri-toggle "Format" filter exposed in the news-flow filter bar.
 *
 *  - flash       — purely cosmetic: paint a Flash chip on each list row
 *                 and collapse the reader to headline-only.
 *  - important   — narrow the visible items to high-priority headlines
 *                 (earnings, M&A, leadership change, regulator action).
 *  - keyFacts    — narrow to short factual updates (announces, appoints,
 *                 declares, …) and render their title as "Key fact : X".
 *
 * When both `important` and `keyFacts` are on the filter takes the
 * union — the user sees anything that qualifies under either bucket.
 */
export interface FormatState {
  flash: boolean;
  important: boolean;
  keyFacts: boolean;
}

export const FORMAT_EMPTY: FormatState = {
  flash: false,
  important: false,
  keyFacts: false,
};

export type FormatKey = keyof FormatState;

export const FORMAT_KEYS: FormatKey[] = ["flash", "important", "keyFacts"];

export function isAnyFormatActive(f: FormatState): boolean {
  return f.flash || f.important || f.keyFacts;
}

export function areAllFormatsActive(f: FormatState): boolean {
  return f.flash && f.important && f.keyFacts;
}

// Heuristic — there's no upstream "importance" score, so we tag items
// by keyword presence in the headline. Tuned for Indian-market filings
// where these terms reliably mark the kind of news traders care about
// before everything else.
const IMPORTANT_RE =
  /\b(result|earning|profit|revenue|quarter|Q[1-4]|YoY|FY\d{2}|merger|acquisition|acquir|takeover|buyout|dividend|guidance|downgrade|upgrade|target\s+price|CEO|CFO|MD|managing director|chairman|resigns?|appoints?|SEBI|RBI|regulator)\b/i;

// Heuristic — short factual filings tend to lead with these verbs.
const KEY_FACT_RE =
  /\b(announces?|appoints?|declares?|approves?|files?|lists?|signs?|raises?|allots?|issues?|withdraws?|resigns?)\b/i;

function isImportant(item: NewsItem): boolean {
  return IMPORTANT_RE.test(item.title);
}

function isKeyFact(item: NewsItem): boolean {
  return KEY_FACT_RE.test(item.title);
}

/**
 * Apply the Format filter to the items list. When neither `important`
 * nor `keyFacts` is selected we pass items through untouched. When at
 * least one is on we keep items that qualify under any active bucket.
 * Items that qualify as key-facts get a "Key fact : " title prefix so
 * the reader and list show the requested format.
 */
export function applyFormat(items: NewsItem[], f: FormatState): NewsItem[] {
  if (!f.important && !f.keyFacts) return items;
  const out: NewsItem[] = [];
  for (const it of items) {
    const kf = f.keyFacts && isKeyFact(it);
    const imp = f.important && isImportant(it);
    if (!kf && !imp) continue;
    if (kf && !it.title.toLowerCase().startsWith("key fact")) {
      out.push({ ...it, title: `Key fact : ${it.title}` });
    } else {
      out.push(it);
    }
  }
  return out;
}
