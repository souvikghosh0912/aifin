# News Flow — Provider & Sector filter dropdowns

**Status:** Design approved 2026-05-26.
**Scope:** Replace the two `DropdownStub` placeholders for Provider and Sector in `src/components/news-flow/news-flow-filter-bar.tsx` with working multi-select popovers, and wire their state through `NewsFlowShell` so the headline list and reader react to the selection.

## Motivation

The News Flow filter bar already has functional Corporate-activity (category) and Format filters. Provider and Sector are currently visual placeholders. Users have no way to scope the headline list to a subset of publishers or to thematic buckets like Finance / Energy Minerals. This spec wires both controls without changing the existing data fetch.

## Architecture

State is owned by `NewsFlowShell` and passed down to `NewsFlowFilterBar`. Items flow through a single pipeline derived in a `useMemo`:

```
serverItems
  → applyFormat(items, format)
  → applySector(items, sectors)
  → applyProvider(items, providers)
  → displayedItems
```

`displayedItems` feeds both `NewsFlowList` and the `selected` article computation, unchanged from today.

### New state in `NewsFlowShell`

- `sectors: Set<SectorId>` — selected sector ids. Empty set = no filter (pass through).
- `providers: Set<string>` — selected publisher names, stored lowercased for case-insensitive matching. Empty set = no filter.

`onResetAll` is extended to clear both new sets along with `category` and `format`.

### Filter ordering rationale

Format is applied first because it is heuristic on title text and may filter out items unrelated to Provider/Sector membership. Sector then narrows to selected sector buckets. Provider is applied last so its checklist (sourced from items after format only — see below) doesn't shrink as sectors are toggled.

## Sector dropdown

### File: `src/components/news-flow/sector-data.ts`

Defines the static taxonomy and the classifier:

```ts
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
  pattern: RegExp;
}

export const SECTORS: readonly Sector[]; // 18 entries, label in the order shown above
```

`pattern` is a case-insensitive regex of representative keywords for that sector. Initial keyword sets (non-exhaustive; tuned for Indian-market reporting):

| Sector                  | Keyword cues                                                                 |
|-------------------------|-------------------------------------------------------------------------------|
| Commercial Services     | consulting, staffing, outsourcing, business services, BPO                     |
| Communications          | telecom, 5G, broadband, fiber, spectrum, ARPU, Jio, Airtel, Vi, BSNL         |
| Consumer Durables       | appliances, smartphone, white goods, electronics retail, washing machine     |
| Consumer Non-Durables   | FMCG, packaged foods, beverages, personal care, soap, detergent, biscuits   |
| Consumer Services       | restaurant, hospitality, hotel, travel, airline, entertainment, multiplex   |
| Distribution Services   | wholesale, distributor, logistics distribution                               |
| Electronic Technology   | semiconductor, chip, electronics manufacturing, EMS, IT hardware, ESDM      |
| Energy Minerals         | oil, gas, petroleum, coal, refining, ONGC, IOC, BPCL, HPCL, GAIL            |
| Finance                 | bank, loan, NBFC, insurance, mutual fund, AMC, RBI, SEBI, fintech, deposit  |
| Government              | ministry, parliament, cabinet, PSU, government, regulator, policy           |
| Health Services         | hospital, clinic, healthcare delivery, diagnostics, pathology               |
| Health Technology       | pharma, biotech, drug, vaccine, medical device, USFDA, clinical trial       |
| Industrial Services     | engineering services, EPC, construction services, oilfield services         |
| Miscellaneous           | (no positive keywords — used as a catch-all when the user adds it)          |
| Non-Energy Minerals     | steel, aluminium, copper, iron ore, cement, mining, metals                  |
| Process Industries      | chemicals, paints, fertilizer, agrochemical, refining (non-fuel), specialty |
| Producer Manufacturing  | machinery, capital goods, industrial equipment, defence manufacturing       |
| Retail Trade            | retail chain, e-commerce, supermarket, kirana, D-Mart, Reliance Retail      |

These regexes are intentionally permissive — they are heuristics, not ground truth. The user can correct misclassifications by leaving the dropdown empty (which disables the filter).

### Classifier

```ts
export function classifySectors(item: NewsItem): Set<SectorId>;
```

Tests each sector's `pattern` against `item.title` (description is not available on `NewsItem` — only on the raw RSS item — so we match on title only). Returns the set of matching sector ids.

### `applySector`

```ts
export function applySector(
  items: NewsItem[],
  selected: Set<SectorId>,
): NewsItem[];
```

- `selected.size === 0` → return `items` unchanged.
- Otherwise → keep items whose `classifySectors(item)` intersects `selected`. Items that match no sector are filtered out.

### File: `src/components/news-flow/sector-popover.tsx`

A popover that mirrors `format-popover.tsx`:

- Trigger chip: `Sector` when empty, `Sector: N` when N sectors are selected. Active styling matches the active Format chip.
- Header row: `SECTORS` label + Reset button (clears the set).
- "Select all" row (toggles between empty and full set).
- Body: 18 `<li>` rows, each a checkbox button identical in structure to the Format checklist.
- Receives `value: Set<SectorId>` and `onChange: (next: Set<SectorId>) => void`.

## Provider dropdown

### File: `src/components/news-flow/provider-data.ts`

```ts
export function uniquePublishers(items: NewsItem[]): string[];
```

- Collects `item.publisher` where not null.
- Normalises with `trim()` then case-insensitive de-duplication using the lowercased key, preserving the first-seen display casing.
- Returns sorted alphabetically (case-insensitive locale compare).

```ts
export function applyProvider(
  items: NewsItem[],
  selected: Set<string>, // lowercased publisher keys
): NewsItem[];
```

- `selected.size === 0` → return `items` unchanged.
- Otherwise → keep items where `item.publisher` is non-null and `item.publisher.toLowerCase()` is in `selected`. Items with `publisher === null` are filtered out when providers are selected.

### File: `src/components/news-flow/provider-popover.tsx`

Mirrors `format-popover.tsx` and `sector-popover.tsx`:

- Trigger chip: `Provider` / `Provider: N`.
- Header label + Reset.
- Select-all toggle.
- Body: one row per publisher derived from `uniquePublishers(itemsAfterFormat)`.
- Empty state: when there are zero publishers in the source list, render a single muted line `No providers in current view.` and disable Select-all and the checklist (Reset stays active so the user can clear stale selections).
- Receives `options: string[]` (display names, sorted), `value: Set<string>` (lowercased keys), `onChange`.

### Source of the option list

The `options` passed to `<ProviderPopover>` is computed in `NewsFlowShell` from `applyFormat(items, format)` — **before** sector and provider filtering. This ensures:

1. Sector toggles never make publishers disappear mid-interaction.
2. A publisher you've checked never disappears from the menu because of your own selection.

## File diff summary

```
src/components/news-flow/
  provider-popover.tsx       ← new (UI)
  provider-data.ts           ← new (uniquePublishers, applyProvider)
  sector-popover.tsx         ← new (UI)
  sector-data.ts             ← new (SECTORS, classifySectors, applySector)
  check-box.tsx              ← new (shared CheckBox visual lifted out of format-popover)
  format-popover.tsx         ← modified: import CheckBox from ./check-box (no behaviour change)
  news-flow-filter-bar.tsx   ← modified: replace 2 DropdownStubs, accept new props
  news-flow-shell.tsx        ← modified: hold sector/provider state, pass derived options
```

`format-popover.tsx`, `format-state.ts`, `news-flow-list.tsx`, `news-flow-reader.tsx`, the route and the news data layer (`src/lib/market/news.ts`) are untouched.

## Component contracts

### `NewsFlowFilterBar` (modified props)

```ts
interface Props {
  symbol: string;
  category: CategoryId;
  onCategoryChange: (next: CategoryId) => void;
  format: FormatState;
  onFormatChange: (next: FormatState) => void;

  sectors: Set<SectorId>;                                       // new
  onSectorsChange: (next: Set<SectorId>) => void;               // new

  providers: Set<string>;                                       // new (lowercased)
  providerOptions: string[];                                    // new (display names)
  onProvidersChange: (next: Set<string>) => void;               // new

  onResetAll: () => void;
  disabled?: boolean;
}
```

### `SectorPopover`

```ts
interface Props {
  value: Set<SectorId>;
  onChange: (next: Set<SectorId>) => void;
}
```

### `ProviderPopover`

```ts
interface Props {
  options: string[];                 // sorted display names
  value: Set<string>;                // lowercased keys
  onChange: (next: Set<string>) => void;
}
```

## UX details

- Both new popovers use the same `Popover`/`PopoverContent` chrome and the same `CheckBox` visual as `FormatPopover`. To avoid duplicating the `CheckBox` component three times, factor it into a tiny shared helper `src/components/news-flow/check-box.tsx` and re-export from `format-popover.tsx`. (Small refactor in service of the new work.)
- Trigger chip active-state styling matches the active Format chip: filled `bg-accent text-foreground` when the set is non-empty, otherwise the default outlined look.
- The `Reset all` button on the third row clears every filter — category, format, sector, provider.
- Disabled state: matches `FormatPopover` — the new popovers stay interactive during the category fetch. Only the Corporate-activity `Select` is disabled while `pending` is true, which is the existing behaviour.

## Testing

This codebase doesn't currently have a unit-test harness for the news-flow components. Verification happens by:

1. Type checking the project (`tsc --noEmit` via the standard Next build).
2. Visiting `/stocks/RELIANCE/news-flow` (or any symbol) and exercising:
   - Open Provider, tick two providers → list narrows to those publishers, chip reads `Provider: 2`.
   - Open Sector, tick `Finance` and `Energy Minerals` → list narrows to headlines matching either bucket; items unrelated to those buckets disappear.
   - Combined: pick a Format, then sectors, then providers → the list is the intersection.
   - Reset all → both new chips clear along with category and format.
   - Provider list visibly stays stable while toggling sectors (acceptance for the source-list rule).
3. No regressions to the Corporate-activity Select or the Format popover.

## Non-goals

- No new server fetches, no changes to `getNews`, no schema changes to `NewsItem`.
- No persistence of selections in the URL or localStorage; selections reset on navigation. (Can be a follow-up.)
- No "Miscellaneous" auto-classification — it's selectable but no headline ever matches it; it exists only because the user listed it.
- The Watchlists / Save / Economics / Country dropdowns remain `DropdownStub`s; they are out of scope for this change.
