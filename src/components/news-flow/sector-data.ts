import type { NewsItem } from "@/lib/market/news";

/**
 * Static sector taxonomy used by the News Flow Sector filter. Each
 * sector has a keyword regex used by classifySectors() to decide which
 * sectors a headline belongs to. The list is intentionally permissive —
 * these are heuristics tuned for Indian-market reporting, not ground
 * truth. Misclassifications are corrected by leaving the filter empty.
 */
export type SectorId =
  | "commercial-services"
  | "communications"
  | "consumer-durables"
  | "consumer-non-durables"
  | "consumer-services"
  | "distribution-services"
  | "electronic-technology"
  | "energy-minerals"
  | "finance"
  | "government"
  | "health-services"
  | "health-technology"
  | "industrial-services"
  | "miscellaneous"
  | "non-energy-minerals"
  | "process-industries"
  | "producer-manufacturing"
  | "retail-trade";

export interface Sector {
  id: SectorId;
  label: string;
  pattern: RegExp | null;
}

// Miscellaneous has `pattern: null` so classifySectors never produces
// it. It exists in the dropdown because the product list includes it,
// but no headline auto-classifies there.
export const SECTORS: readonly Sector[] = [
  {
    id: "commercial-services",
    label: "Commercial Services",
    pattern:
      /\b(consulting|staffing|outsourcing|business services|BPO|KPO)\b/i,
  },
  {
    id: "communications",
    label: "Communications",
    pattern:
      /\b(telecom|5G|broadband|fiber|spectrum|ARPU|Jio|Airtel|Vodafone\s*Idea|Vi|BSNL)\b/i,
  },
  {
    id: "consumer-durables",
    label: "Consumer Durables",
    pattern:
      /\b(appliances?|smartphones?|white goods|electronics retail|washing machine|refrigerator|television|TV sales)\b/i,
  },
  {
    id: "consumer-non-durables",
    label: "Consumer Non-Durables",
    pattern:
      /\b(FMCG|packaged foods|beverages|personal care|soap|detergent|biscuits|toothpaste|shampoo)\b/i,
  },
  {
    id: "consumer-services",
    label: "Consumer Services",
    pattern:
      /\b(restaurant|hospitality|hotels?|travel|airline|entertainment|multiplex|cinema|tourism)\b/i,
  },
  {
    id: "distribution-services",
    label: "Distribution Services",
    pattern:
      /\b(wholesale|distributor|logistics distribution|warehousing distribution)\b/i,
  },
  {
    id: "electronic-technology",
    label: "Electronic Technology",
    pattern:
      /\b(semiconductor|chip|electronics manufacturing|EMS|IT hardware|ESDM|fab)\b/i,
  },
  {
    id: "energy-minerals",
    label: "Energy Minerals",
    pattern:
      /\b(oil|gas|petroleum|crude|coal|refining|ONGC|IOC|BPCL|HPCL|GAIL|Reliance Industries|RIL)\b/i,
  },
  {
    id: "finance",
    label: "Finance",
    pattern:
      /\b(bank(?:ing|s)?|loans?|NBFC|insurance|mutual fund|AMC|RBI|SEBI|fintech|deposit|credit card)\b/i,
  },
  {
    id: "government",
    label: "Government",
    pattern:
      /\b(ministry|parliament|cabinet|PSU|government|regulator|policy|budget)\b/i,
  },
  {
    id: "health-services",
    label: "Health Services",
    pattern:
      /\b(hospital|clinic|healthcare delivery|diagnostics|pathology)\b/i,
  },
  {
    id: "health-technology",
    label: "Health Technology",
    pattern:
      /\b(pharma|biotech|drug|vaccine|medical device|USFDA|clinical trial|API\s+pharma)\b/i,
  },
  {
    id: "industrial-services",
    label: "Industrial Services",
    pattern:
      /\b(engineering services|EPC|construction services|oilfield services)\b/i,
  },
  {
    id: "miscellaneous",
    label: "Miscellaneous",
    pattern: null,
  },
  {
    id: "non-energy-minerals",
    label: "Non-Energy Minerals",
    pattern:
      /\b(steel|aluminium|aluminum|copper|iron ore|cement|mining|metals?)\b/i,
  },
  {
    id: "process-industries",
    label: "Process Industries",
    pattern:
      /\b(chemicals?|paints?|fertili[sz]ers?|agrochemical|specialty chemical)\b/i,
  },
  {
    id: "producer-manufacturing",
    label: "Producer Manufacturing",
    pattern:
      /\b(machinery|capital goods|industrial equipment|defence manufacturing|defense manufacturing)\b/i,
  },
  {
    id: "retail-trade",
    label: "Retail Trade",
    pattern:
      /\b(retail chain|e-?commerce|supermarket|kirana|D-?Mart|Reliance Retail)\b/i,
  },
];

/**
 * Returns the set of sectors whose keyword pattern matches the
 * headline. Tests against `item.title` only — `NewsItem` does not
 * expose the raw RSS description.
 */
export function classifySectors(item: NewsItem): Set<SectorId> {
  const out = new Set<SectorId>();
  for (const s of SECTORS) {
    if (s.pattern && s.pattern.test(item.title)) {
      out.add(s.id);
    }
  }
  return out;
}

/**
 * Keep items whose classified sectors intersect `selected`. Empty
 * selection is a pass-through. Items that match no sector are dropped
 * when the selection is non-empty.
 */
export function applySector(
  items: NewsItem[],
  selected: Set<SectorId>,
): NewsItem[] {
  if (selected.size === 0) return items;
  const out: NewsItem[] = [];
  for (const it of items) {
    const ids = classifySectors(it);
    for (const id of ids) {
      if (selected.has(id)) {
        out.push(it);
        break;
      }
    }
  }
  return out;
}
