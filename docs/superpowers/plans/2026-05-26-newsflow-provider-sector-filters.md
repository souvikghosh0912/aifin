# News Flow Provider & Sector Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two placeholder `DropdownStub` entries for Provider and Sector in the news-flow filter bar with working multi-select popovers, with sector membership determined by keyword classification and the provider list sourced from publishers in items after the existing Format filter.

**Architecture:** Two new pure-logic modules (`sector-data.ts`, `provider-data.ts`) feed two new popover components (`sector-popover.tsx`, `provider-popover.tsx`). State for both lives in `NewsFlowShell` alongside `category` / `format`; items flow through `applyFormat → applySector → applyProvider` to produce `displayedItems`. A small `CheckBox` component is lifted out of `format-popover.tsx` so all three popovers can share it.

**Tech Stack:** Next.js 15 App Router, React 19, Radix UI (Popover), Tailwind, TypeScript, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-26-newsflow-provider-sector-filters-design.md`

---

## File map

```
src/components/news-flow/
  sector-data.ts             ← new (SECTORS, classifySectors, applySector)
  provider-data.ts           ← new (uniquePublishers, applyProvider)
  check-box.tsx              ← new (shared CheckBox visual)
  sector-popover.tsx         ← new (UI)
  provider-popover.tsx       ← new (UI)
  format-popover.tsx         ← modify (import CheckBox from ./check-box)
  news-flow-filter-bar.tsx   ← modify (replace 2 DropdownStubs, accept new props)
  news-flow-shell.tsx        ← modify (hold sector/provider state, pass derived options)

tests/components/news-flow/
  sector-data.test.ts        ← new
  provider-data.test.ts      ← new
```

`format-state.ts`, `news-flow-list.tsx`, `news-flow-reader.tsx`, `news-flow-header.tsx`, `instrument-popover.tsx`, the route file, and `src/lib/market/news.ts` are untouched.

---

### Task 1: Sector taxonomy + classifier (TDD)

**Files:**
- Create: `src/components/news-flow/sector-data.ts`
- Create: `tests/components/news-flow/sector-data.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/news-flow/sector-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { NewsItem } from "@/lib/market/news";
import {
  SECTORS,
  applySector,
  classifySectors,
  type SectorId,
} from "@/components/news-flow/sector-data";

function item(title: string, id = title): NewsItem {
  return {
    id,
    title,
    publisher: null,
    publishedAt: "2026-05-26T00:00:00.000Z",
    link: `https://example.com/${id}`,
    thumbnail: null,
    relatedTickers: [],
  };
}

describe("SECTORS", () => {
  it("contains all 18 sector ids in the documented order", () => {
    const expected: SectorId[] = [
      "commercial-services",
      "communications",
      "consumer-durables",
      "consumer-non-durables",
      "consumer-services",
      "distribution-services",
      "electronic-technology",
      "energy-minerals",
      "finance",
      "government",
      "health-services",
      "health-technology",
      "industrial-services",
      "miscellaneous",
      "non-energy-minerals",
      "process-industries",
      "producer-manufacturing",
      "retail-trade",
    ];
    expect(SECTORS.map((s) => s.id)).toEqual(expected);
  });

  it("exposes a human label for every sector", () => {
    for (const s of SECTORS) {
      expect(s.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("classifySectors", () => {
  it("returns Finance for banking headlines", () => {
    const ids = classifySectors(item("HDFC Bank announces record loan growth"));
    expect(ids.has("finance")).toBe(true);
  });

  it("returns Energy Minerals for oil & gas headlines", () => {
    const ids = classifySectors(item("ONGC posts higher Q1 profit on oil prices"));
    expect(ids.has("energy-minerals")).toBe(true);
  });

  it("can return multiple sectors when keywords overlap", () => {
    const ids = classifySectors(
      item("RBI fines bank over insurance mis-selling"),
    );
    expect(ids.has("finance")).toBe(true);
  });

  it("returns an empty set when no keyword matches", () => {
    expect(classifySectors(item("Cricket team wins toss")).size).toBe(0);
  });

  it("never matches Miscellaneous", () => {
    for (const s of SECTORS) {
      const ids = classifySectors(item(s.label));
      expect(ids.has("miscellaneous")).toBe(false);
    }
  });
});

describe("applySector", () => {
  const items = [
    item("HDFC Bank profit rises", "a"),
    item("ONGC quarterly results", "b"),
    item("Cricket team wins toss", "c"),
  ];

  it("returns items unchanged when no sector selected", () => {
    expect(applySector(items, new Set())).toEqual(items);
  });

  it("keeps only items intersecting the selection", () => {
    const out = applySector(items, new Set<SectorId>(["finance"]));
    expect(out.map((i) => i.id)).toEqual(["a"]);
  });

  it("union semantics across multiple selected sectors", () => {
    const out = applySector(
      items,
      new Set<SectorId>(["finance", "energy-minerals"]),
    );
    expect(out.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("drops items that match no sector when selection is non-empty", () => {
    const out = applySector(items, new Set<SectorId>(["finance"]));
    expect(out.map((i) => i.id)).not.toContain("c");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/news-flow/sector-data.test.ts`
Expected: FAIL — module `@/components/news-flow/sector-data` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/components/news-flow/sector-data.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/news-flow/sector-data.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/components/news-flow/sector-data.ts tests/components/news-flow/sector-data.test.ts
git commit -m "feat(news-flow): sector taxonomy and keyword classifier"
```

---

### Task 2: Provider data helpers (TDD)

**Files:**
- Create: `src/components/news-flow/provider-data.ts`
- Create: `tests/components/news-flow/provider-data.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/news-flow/provider-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { NewsItem } from "@/lib/market/news";
import {
  applyProvider,
  uniquePublishers,
} from "@/components/news-flow/provider-data";

function item(publisher: string | null, id = publisher ?? "null"): NewsItem {
  return {
    id,
    title: `Story from ${publisher ?? "unknown"}`,
    publisher,
    publishedAt: "2026-05-26T00:00:00.000Z",
    link: `https://example.com/${id}`,
    thumbnail: null,
    relatedTickers: [],
  };
}

describe("uniquePublishers", () => {
  it("returns publishers sorted alphabetically, case-insensitive", () => {
    const out = uniquePublishers([
      item("Reuters"),
      item("Mint"),
      item("Bloomberg"),
    ]);
    expect(out).toEqual(["Bloomberg", "Mint", "Reuters"]);
  });

  it("de-duplicates case-insensitively, keeping first-seen casing", () => {
    const out = uniquePublishers([
      item("Mint", "a"),
      item("mint", "b"),
      item("MINT", "c"),
    ]);
    expect(out).toEqual(["Mint"]);
  });

  it("trims whitespace before comparing", () => {
    const out = uniquePublishers([
      item("Mint", "a"),
      item("  Mint  ", "b"),
    ]);
    expect(out).toEqual(["Mint"]);
  });

  it("skips items with null publisher", () => {
    const out = uniquePublishers([
      item("Mint", "a"),
      item(null, "b"),
    ]);
    expect(out).toEqual(["Mint"]);
  });

  it("returns an empty array when no items have publishers", () => {
    expect(uniquePublishers([item(null, "a"), item(null, "b")])).toEqual([]);
  });
});

describe("applyProvider", () => {
  const items = [
    item("Mint", "a"),
    item("Reuters", "b"),
    item(null, "c"),
  ];

  it("returns items unchanged when selection is empty", () => {
    expect(applyProvider(items, new Set())).toEqual(items);
  });

  it("keeps items whose publisher key is in the selection", () => {
    const out = applyProvider(items, new Set(["mint"]));
    expect(out.map((i) => i.id)).toEqual(["a"]);
  });

  it("matches case-insensitively (publisher casing in items can vary)", () => {
    const data = [item("MINT", "x"), item("Mint", "y")];
    const out = applyProvider(data, new Set(["mint"]));
    expect(out.map((i) => i.id)).toEqual(["x", "y"]);
  });

  it("drops items with null publisher when selection is non-empty", () => {
    const out = applyProvider(items, new Set(["mint"]));
    expect(out.map((i) => i.id)).not.toContain("c");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/news-flow/provider-data.test.ts`
Expected: FAIL — module `@/components/news-flow/provider-data` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/components/news-flow/provider-data.ts`:

```ts
import type { NewsItem } from "@/lib/market/news";

/**
 * Returns the unique publisher names visible in `items`, sorted
 * alphabetically (case-insensitive locale compare). Trims whitespace
 * before comparing and de-duplicates case-insensitively while
 * preserving the first-seen display casing. Items without a publisher
 * are skipped.
 */
export function uniquePublishers(items: NewsItem[]): string[] {
  const seen = new Map<string, string>(); // lowercased key → display
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/news-flow/provider-data.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/components/news-flow/provider-data.ts tests/components/news-flow/provider-data.test.ts
git commit -m "feat(news-flow): provider list + filter helpers"
```

---

### Task 3: Extract shared CheckBox component

**Files:**
- Create: `src/components/news-flow/check-box.tsx`
- Modify: `src/components/news-flow/format-popover.tsx` (replace inline `CheckBox` with import)

- [ ] **Step 1: Create the shared component**

Create `src/components/news-flow/check-box.tsx`:

```tsx
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Square checkbox visual used by every filter popover in the News Flow
 * filter bar (Format, Sector, Provider). Purely presentational — the
 * caller owns the toggle state and click handler.
 */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded-sm border",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background",
      )}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}
```

- [ ] **Step 2: Update `format-popover.tsx` to import the shared CheckBox**

In `src/components/news-flow/format-popover.tsx`:

a) Replace the imports block at the top so it no longer pulls `Check` from `lucide-react` (other lucide imports stay). Change:

```tsx
import { Check, ChevronDown, RotateCcw, Zap } from "lucide-react";
```

to:

```tsx
import { ChevronDown, RotateCcw, Zap } from "lucide-react";
```

b) Below the existing `import { cn } from "@/lib/utils";` line (keep that line intact), add:

```tsx
import { CheckBox } from "./check-box";
```

c) Delete the entire inline `CheckBox` function at the bottom of the file (the block that begins `function CheckBox({ checked }: { checked: boolean }) {` and ends at its closing `}`).

- [ ] **Step 3: Verify Format popover still type-checks**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. `CheckBox` is now resolved from `./check-box`.

- [ ] **Step 4: Run the existing test suite**

Run: `npx vitest run`
Expected: PASS — no regressions. (No existing tests target FormatPopover; this is a sanity check.)

- [ ] **Step 5: Commit**

```bash
git add src/components/news-flow/check-box.tsx src/components/news-flow/format-popover.tsx
git commit -m "refactor(news-flow): lift CheckBox into a shared component"
```

---

### Task 4: SectorPopover component

**Files:**
- Create: `src/components/news-flow/sector-popover.tsx`

- [ ] **Step 1: Implement the popover**

Create `src/components/news-flow/sector-popover.tsx`:

```tsx
"use client";

import { ChevronDown, RotateCcw } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CheckBox } from "./check-box";
import { SECTORS, type SectorId } from "./sector-data";

interface Props {
  value: Set<SectorId>;
  onChange: (next: Set<SectorId>) => void;
}

/**
 * Multi-select popover for the News Flow Sector filter. Mirrors
 * FormatPopover's chrome: Reset button in the header, Select-all
 * toggle row, then a checklist. Empty value renders the default chip
 * label; a non-empty value renders "Sector: N".
 */
export function SectorPopover({ value, onChange }: Props) {
  const active = value.size > 0;
  const allOn = value.size === SECTORS.length;

  const toggle = (id: SectorId) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const reset = () => onChange(new Set());
  const toggleAll = () => {
    if (allOn) onChange(new Set());
    else onChange(new Set(SECTORS.map((s) => s.id)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-sm border border-border px-2 text-[12px] font-medium hover:bg-accent",
            active
              ? "bg-accent text-foreground"
              : "bg-background text-foreground/80 hover:text-foreground",
          )}
          aria-label="Filter by sector"
        >
          <span>Sector{active ? `: ${value.size}` : ""}</span>
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sector
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            <span>Reset</span>
          </button>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="flex w-full items-center gap-2 border-y px-3 py-2 text-[13px] font-medium text-foreground hover:bg-accent/60"
        >
          <CheckBox checked={allOn} />
          <span>Select all</span>
        </button>
        <ul className="max-h-[280px] overflow-y-auto py-1">
          {SECTORS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-accent/60"
              >
                <CheckBox checked={value.has(s.id)} />
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/news-flow/sector-popover.tsx
git commit -m "feat(news-flow): SectorPopover multi-select control"
```

---

### Task 5: ProviderPopover component

**Files:**
- Create: `src/components/news-flow/provider-popover.tsx`

- [ ] **Step 1: Implement the popover**

Create `src/components/news-flow/provider-popover.tsx`:

```tsx
"use client";

import { ChevronDown, RotateCcw } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CheckBox } from "./check-box";

interface Props {
  /** Sorted display names of publishers visible in the current items
   *  (after the Format filter, before Sector/Provider). */
  options: string[];
  /** Lowercased publisher keys currently selected. */
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}

/**
 * Multi-select popover for the News Flow Provider filter. The
 * option list is computed by the parent (NewsFlowShell) from the
 * items visible after the Format filter — that keeps the menu stable
 * while the user toggles Sector and prevents a selected publisher
 * from disappearing because of its own selection.
 */
export function ProviderPopover({ options, value, onChange }: Props) {
  const active = value.size > 0;
  const allOn = options.length > 0 && options.every((o) => value.has(key(o)));
  const empty = options.length === 0;

  const toggle = (display: string) => {
    const next = new Set(value);
    const k = key(display);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  const reset = () => onChange(new Set());
  const toggleAll = () => {
    if (empty) return;
    if (allOn) onChange(new Set());
    else onChange(new Set(options.map(key)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-sm border border-border px-2 text-[12px] font-medium hover:bg-accent",
            active
              ? "bg-accent text-foreground"
              : "bg-background text-foreground/80 hover:text-foreground",
          )}
          aria-label="Filter by provider"
        >
          <span>Provider{active ? `: ${value.size}` : ""}</span>
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Provider
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            <span>Reset</span>
          </button>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={empty}
          className="flex w-full items-center gap-2 border-y px-3 py-2 text-[13px] font-medium text-foreground hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <CheckBox checked={allOn} />
          <span>Select all</span>
        </button>
        {empty ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            No providers in current view.
          </p>
        ) : (
          <ul className="max-h-[280px] overflow-y-auto py-1">
            {options.map((display) => (
              <li key={key(display)}>
                <button
                  type="button"
                  onClick={() => toggle(display)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-accent/60"
                >
                  <CheckBox checked={value.has(key(display))} />
                  <span className="truncate">{display}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function key(display: string): string {
  return display.trim().toLowerCase();
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/news-flow/provider-popover.tsx
git commit -m "feat(news-flow): ProviderPopover multi-select control"
```

---

### Task 6: Wire popovers into NewsFlowFilterBar

**Files:**
- Modify: `src/components/news-flow/news-flow-filter-bar.tsx`

- [ ] **Step 1: Update the file**

Replace the entire contents of `src/components/news-flow/news-flow-filter-bar.tsx` with:

```tsx
"use client";

import { ChevronDown, X } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryId } from "@/lib/market/news";
import { cn } from "@/lib/utils";

import { FormatPopover } from "./format-popover";
import type { FormatState } from "./format-state";
import { InstrumentPopover } from "./instrument-popover";
import { ProviderPopover } from "./provider-popover";
import { SectorPopover } from "./sector-popover";
import type { SectorId } from "./sector-data";

interface Props {
  symbol: string;
  category: CategoryId;
  onCategoryChange: (next: CategoryId) => void;
  format: FormatState;
  onFormatChange: (next: FormatState) => void;
  sectors: Set<SectorId>;
  onSectorsChange: (next: Set<SectorId>) => void;
  providers: Set<string>;
  providerOptions: string[];
  onProvidersChange: (next: Set<string>) => void;
  /** Resets every wired filter — category, format, sector, provider —
   *  back to defaults. */
  onResetAll: () => void;
  disabled?: boolean;
}

const CATEGORY_OPTIONS: { id: CategoryId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "key-facts", label: "Key facts" },
  { id: "earnings", label: "Earnings" },
  { id: "earnings-calls", label: "Earnings calls" },
  { id: "dividends", label: "Dividends" },
  { id: "strategy", label: "Strategy, business, and management" },
  { id: "mergers", label: "Mergers and acquisitions" },
  { id: "management", label: "Management" },
  { id: "esg", label: "ESG and regulation" },
  { id: "analysts", label: "Analysts" },
];

/**
 * Multi-row filter bar matching newsflow.png: every field is a
 * bordered dropdown button. Corporate activity, Format, Sector,
 * Provider, and the instrument chip are wired to real state; the
 * remaining slots (Watchlists, Save, Economics, Country) are visual
 * stubs because the page doesn't yet have data sources behind them.
 * "Reset all" clears every wired filter.
 */
export function NewsFlowFilterBar({
  symbol,
  category,
  onCategoryChange,
  format,
  onFormatChange,
  sectors,
  onSectorsChange,
  providers,
  providerOptions,
  onProvidersChange,
  onResetAll,
  disabled = false,
}: Props) {
  const activeLabel =
    CATEGORY_OPTIONS.find((o) => o.id === category)?.label ?? "All";

  return (
    <div className="space-y-2 border-y py-3 text-[13px]">
      <FilterRow>
        <DropdownStub label="Watchlists" />
        <InstrumentPopover activeSymbol={symbol} />
        <DropdownStub label="Save" />
        <SectorPopover value={sectors} onChange={onSectorsChange} />
      </FilterRow>

      <FilterRow>
        <Select
          value={category}
          onValueChange={(v) => onCategoryChange(v as CategoryId)}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-7 max-w-[200px] gap-1 rounded-sm border border-border bg-background px-2 py-0 text-[12px] font-medium text-foreground hover:bg-accent focus:ring-0 focus:ring-offset-0"
            aria-label="Filter by corporate activity"
          >
            <SelectValue>
              <span className="text-foreground/70">Corporate activity:</span>{" "}
              <span>{activeLabel}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="w-[220px] min-w-0">
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {category !== "all" ? (
          <button
            type="button"
            aria-label="Clear corporate-activity filter"
            onClick={() => onCategoryChange("all")}
            className="grid h-6 w-6 place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        ) : null}
        <DropdownStub label="Economics" />
        <DropdownStub label="Country" />
        <ProviderPopover
          options={providerOptions}
          value={providers}
          onChange={onProvidersChange}
        />
      </FilterRow>

      <FilterRow>
        <FormatPopover value={format} onChange={onFormatChange} />
        <button
          type="button"
          onClick={onResetAll}
          className="ml-auto text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          Reset all
        </button>
      </FilterRow>
    </div>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  );
}

// Bordered dropdown trigger that matches the visual style of the
// real category Select. The labelled stubs don't have data backing yet
// — they render as clickable buttons so the bar reads as a grid of
// dropdowns rather than a mix of text + chips.
function DropdownStub({ label }: { label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-background px-2 text-[12px] font-medium text-foreground/80 hover:bg-accent hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 2: Verify type-check fails on the shell**

Run: `npx tsc --noEmit`
Expected: FAIL — `news-flow-shell.tsx` no longer satisfies the new `NewsFlowFilterBar` props (missing `sectors`, `onSectorsChange`, `providers`, `providerOptions`, `onProvidersChange`). This is the cue to do Task 7 next.

- [ ] **Step 3: Commit**

```bash
git add src/components/news-flow/news-flow-filter-bar.tsx
git commit -m "feat(news-flow): wire Sector + Provider popovers into filter bar"
```

---

### Task 7: Add state and wire-through in NewsFlowShell

**Files:**
- Modify: `src/components/news-flow/news-flow-shell.tsx`

- [ ] **Step 1: Update the file**

Replace the entire contents of `src/components/news-flow/news-flow-shell.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify the whole project type-checks**

Run: `npx tsc --noEmit`
Expected: PASS — no errors anywhere.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — the new sector-data and provider-data tests are green; nothing else regressed.

- [ ] **Step 4: Commit**

```bash
git add src/components/news-flow/news-flow-shell.tsx
git commit -m "feat(news-flow): wire sector + provider state through shell"
```

---

### Task 8: Manual smoke test in the dev server

**Files:** none modified — verification only.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next.js starts on `http://localhost:3000` without errors.

- [ ] **Step 2: Open a news-flow page**

Navigate to `http://localhost:3000/stocks/RELIANCE/news-flow` in a browser.

Expected:
- Filter bar renders three rows.
- The Sector chip is on row 1 (rightmost), Provider chip is on row 2 (rightmost).
- Each chip opens a popover with header label + Reset, Select-all row, and a checklist.

- [ ] **Step 3: Exercise the Provider filter**

In the Provider popover, tick one or two publishers.

Expected:
- The headline list shrinks to only those publishers.
- The chip trigger updates to `Provider: N`.
- Un-ticking a publisher restores its rows.
- The publishers visible in the dropdown match the publisher column shown in the list before filtering.

- [ ] **Step 4: Exercise the Sector filter**

In the Sector popover, tick Finance, then add Energy Minerals.

Expected:
- The headline list narrows to items whose title contains keywords from those sectors (HDFC Bank, ONGC, RBI, etc.).
- Headlines unrelated to those sectors disappear.
- The chip trigger updates to `Sector: 2`.

- [ ] **Step 5: Verify the provider list is stable while toggling sectors**

With a publisher checked in Provider, open Sector and toggle different sectors. The Provider popover's option list should not lose the publisher you have checked.

Expected: the publisher stays in the menu and stays checked. (Acceptance for the source-list rule from the spec.)

- [ ] **Step 6: Verify Reset all**

Click "Reset all" on row 3.

Expected: Sector chip returns to `Sector`, Provider chip to `Provider`, Format clears, category returns to All, and the full headline list is restored.

- [ ] **Step 7: Verify Corporate-activity still works**

Change Corporate activity to "Earnings". Expected: list refetches and narrows. Sector and Provider chips remain interactive during the fetch (only the Corporate-activity Select is disabled while `pending`).

- [ ] **Step 8: Stop the dev server**

Press Ctrl-C in the terminal running `npm run dev`.

(No commit — this task only verifies behaviour.)

---

## Notes for the engineer

- This codebase uses Next.js App Router with `"use client"` directives at the top of every interactive component file. All new popover components live on the client side.
- The shadcn-style `Popover`, `PopoverTrigger`, `PopoverContent` primitives are already imported throughout `src/components/news-flow/`. Don't introduce a different popover library.
- `Set<SectorId>` and `Set<string>` are passed by reference. Every state update must produce a **new** Set (the popovers already do this via `const next = new Set(value); next.add(...)`). Don't mutate the existing Set or React won't re-render.
- The keyword regex in `sector-data.ts` is intentionally permissive and tuned for Indian-market reporting. If you find a sector keyword set is producing obvious false positives during smoke testing, narrow it — but don't get pulled into a long classifier-tuning loop, this is heuristic by design.
- `NewsItem.publisher` is `string | null`. Items with `publisher === null` are filtered out when any provider is selected — this is intentional and matches what users expect from "filter to these publishers".
- File-organisation rule for this part of the codebase: separate UI and logic files (e.g. `sector-popover.tsx` ↔ `sector-data.ts`). Don't combine them.
