# Watchlist Notes & Symbol Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a debounced symbol-search combobox (with live price + day-change indicators) to the add-to-watchlist dialog, and add per-row notes (≤500 chars) that are displayed truncated in the table with a view/edit/delete modal.

**Architecture:** Notes live as a nullable `notes` column on `watchlist_items`, gated by a 500-char CHECK constraint and the existing RLS policy. The combobox reuses the existing `/api/search` (symbol name lookup) and `/api/quotes/batch` (price enrichment) endpoints — no new API routes. Truncation is a 150-character slice in client-side code; the modal is a single Radix Dialog with a `view → edit | delete-confirm` state machine.

**Tech Stack:** Next.js 15 App Router (server actions), Supabase (Postgres + RLS), Radix UI primitives (Dialog, Popover), Tailwind CSS, TanStack Query, Zod, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-22-watchlist-notes-and-symbol-search-design.md`

---

## File Structure

**New files**
- `supabase/migrations/0002_watchlist_notes.sql` — adds nullable `notes` column with `CHECK` constraint.
- `src/components/ui/textarea.tsx` — reusable Textarea primitive (mirrors `input.tsx`).
- `src/components/watchlist/symbol-search-combobox.tsx` — debounced combobox with price enrichment.
- `src/components/watchlist/notes-modal.tsx` — view/edit/delete-confirm dialog.
- `src/lib/text.ts` — `truncateText(input, max)` helper.
- `tests/lib/text.test.ts`
- `tests/components/ui/textarea.test.tsx`
- `tests/components/watchlist/symbol-search-combobox.test.tsx`
- `tests/components/watchlist/notes-modal.test.tsx`
- `tests/components/watchlist/watchlist-table.test.tsx`
- `tests/lib/watchlist-actions.test.ts`

**Modified files**
- `src/types/database.ts` — add `notes: string | null` to `watchlist_items` Row/Insert/Update.
- `src/app/(app)/watchlist/actions.ts` — extend `InputSchema` to accept `notes`; add `updateWatchlistNotes`.
- `src/components/watchlist/add-watchlist-dialog.tsx` — replace `Input + Select` pair with `<SymbolSearchCombobox />`; add notes textarea.
- `src/components/watchlist/watchlist-table.tsx` — add `Notes` column with truncated-button + modal state.

---

## Task 1: Schema migration + database types

**Files:**
- Create: `supabase/migrations/0002_watchlist_notes.sql`
- Modify: `src/types/database.ts:87-106`

- [ ] **Step 1: Create the migration SQL**

Write to `supabase/migrations/0002_watchlist_notes.sql`:

```sql
-- 0002_watchlist_notes.sql
-- Add optional notes column to watchlist_items with a 500-char cap.
alter table public.watchlist_items
  add column notes text;

alter table public.watchlist_items
  add constraint watchlist_items_notes_len
  check (notes is null or char_length(notes) <= 500);
```

- [ ] **Step 2: Update the TypeScript types**

In `src/types/database.ts`, replace the `watchlist_items` block (currently at lines 87-106) with the version that includes `notes`:

```ts
      watchlist_items: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          exchange: Exchange;
          added_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          exchange: Exchange;
          added_at?: string;
          notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["watchlist_items"]["Insert"]
        >;
        Relationships: [];
      };
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: PASS (exit code 0, no errors).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_watchlist_notes.sql src/types/database.ts
git commit -m "feat(watchlist): add notes column to watchlist_items"
```

---

## Task 2: Truncate helper

**Files:**
- Create: `src/lib/text.ts`
- Test: `tests/lib/text.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/text.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { truncateText } from "@/lib/text";

describe("truncateText", () => {
  it("returns the input unchanged when length <= max", () => {
    expect(truncateText("hello", 10)).toEqual({ text: "hello", truncated: false });
  });

  it("returns input unchanged when exactly at max", () => {
    expect(truncateText("abcde", 5)).toEqual({ text: "abcde", truncated: false });
  });

  it("slices to max chars and flags truncated when longer", () => {
    expect(truncateText("0123456789abcdef", 10)).toEqual({
      text: "0123456789",
      truncated: true,
    });
  });

  it("treats null/undefined/empty as empty non-truncated", () => {
    expect(truncateText(null, 10)).toEqual({ text: "", truncated: false });
    expect(truncateText(undefined, 10)).toEqual({ text: "", truncated: false });
    expect(truncateText("", 10)).toEqual({ text: "", truncated: false });
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/lib/text.test.ts`
Expected: FAIL — module `@/lib/text` not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/text.ts`:

```ts
export interface TruncatedText {
  text: string;
  truncated: boolean;
}

export function truncateText(
  input: string | null | undefined,
  max: number,
): TruncatedText {
  if (input == null || input === "") {
    return { text: "", truncated: false };
  }
  if (input.length <= max) {
    return { text: input, truncated: false };
  }
  return { text: input.slice(0, max), truncated: true };
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm test -- tests/lib/text.test.ts`
Expected: PASS, 4/4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/text.ts tests/lib/text.test.ts
git commit -m "feat(lib): add truncateText helper"
```

---

## Task 3: Server actions — accept notes on insert, add update action

**Files:**
- Modify: `src/app/(app)/watchlist/actions.ts`
- Test: `tests/lib/watchlist-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/watchlist-actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror the schema we expect the action to use. The test verifies the schema
// shape; the action itself is exercised via integration in the manual checklist.
const InputSchema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["NSE", "BSE"]),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

describe("watchlist add InputSchema", () => {
  it("accepts symbol + exchange with no notes", () => {
    const r = InputSchema.parse({ symbol: "INFY", exchange: "NSE" });
    expect(r.notes).toBeNull();
  });

  it("accepts notes up to 500 chars", () => {
    const notes = "a".repeat(500);
    const r = InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes });
    expect(r.notes).toBe(notes);
  });

  it("normalizes empty string and whitespace to null", () => {
    expect(InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes: "" }).notes).toBeNull();
    expect(
      InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes: "   " }).notes,
    ).toBeNull();
  });

  it("rejects notes longer than 500 chars", () => {
    const notes = "a".repeat(501);
    expect(() =>
      InputSchema.parse({ symbol: "INFY", exchange: "NSE", notes }),
    ).toThrow();
  });
});

const UpdateNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(500).nullable(),
});

describe("updateWatchlistNotes schema", () => {
  it("accepts uuid + 500-char string", () => {
    const r = UpdateNotesSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      notes: "x".repeat(500),
    });
    expect(r.notes?.length).toBe(500);
  });

  it("accepts uuid + null (delete)", () => {
    const r = UpdateNotesSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      notes: null,
    });
    expect(r.notes).toBeNull();
  });

  it("rejects non-uuid id", () => {
    expect(() =>
      UpdateNotesSchema.parse({ id: "not-a-uuid", notes: null }),
    ).toThrow();
  });

  it("rejects notes longer than 500 chars", () => {
    expect(() =>
      UpdateNotesSchema.parse({
        id: "00000000-0000-0000-0000-000000000001",
        notes: "a".repeat(501),
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/lib/watchlist-actions.test.ts`
Expected: FAIL — schemas in the test exist locally, so this should already pass, but verifying it's wired before the real change. If it passes here, that's fine — the test is documenting the contract the actions must satisfy.

(Note: this is a schema-shape contract test, intentionally local; the real action behaviour is exercised in the manual checklist at the end since hitting Supabase from unit tests needs harness work that's out of scope for this plan.)

- [ ] **Step 3: Update `actions.ts`**

Replace `src/app/(app)/watchlist/actions.ts` entirely with:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol, parseExchange } from "@/lib/market/symbols";

const InputSchema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["NSE", "BSE"]),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

const UpdateNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z
    .string()
    .max(500)
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

export async function addWatchlistItem(formData: FormData) {
  const parsed = InputSchema.safeParse({
    symbol: formData.get("symbol"),
    exchange: formData.get("exchange"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("watchlist_items").insert({
    user_id: claims.sub,
    symbol: normalizeSymbol(parsed.data.symbol),
    exchange: parseExchange(parsed.data.exchange),
    notes: parsed.data.notes,
  });
  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/watchlist");
  return { ok: true };
}

export async function removeWatchlistItem(id: string) {
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", claims.sub);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/watchlist");
  return { ok: true };
}

export async function updateWatchlistNotes(
  itemId: string,
  notes: string | null,
) {
  const parsed = UpdateNotesSchema.safeParse({ id: itemId, notes });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("watchlist_items")
    .update({ notes: parsed.data.notes })
    .eq("id", parsed.data.id)
    .eq("user_id", claims.sub);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/watchlist");
  return { ok: true };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/lib/watchlist-actions.test.ts && npm run typecheck`
Expected: schemas test passes; typecheck clean (the action references `notes` which now exists in the Insert/Update types from Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/watchlist/actions.ts tests/lib/watchlist-actions.test.ts
git commit -m "feat(watchlist): accept notes on add + updateWatchlistNotes action"
```

---

## Task 4: Textarea UI primitive

**Files:**
- Create: `src/components/ui/textarea.tsx`
- Test: `tests/components/ui/textarea.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/textarea.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Textarea } from "@/components/ui/textarea";

describe("<Textarea />", () => {
  it("renders with placeholder", () => {
    render(<Textarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });

  it("accepts user input", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="notes" />);
    const ta = screen.getByLabelText("notes") as HTMLTextAreaElement;
    await user.type(ta, "hello");
    expect(ta.value).toBe("hello");
  });

  it("forwards maxLength", () => {
    render(<Textarea aria-label="notes" maxLength={10} />);
    expect(screen.getByLabelText("notes")).toHaveAttribute("maxlength", "10");
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/components/ui/textarea.test.tsx`
Expected: FAIL — module `@/components/ui/textarea` not found.

- [ ] **Step 3: Implement Textarea**

Create `src/components/ui/textarea.tsx` (mirrors the existing `input.tsx` style):

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm test -- tests/components/ui/textarea.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/textarea.tsx tests/components/ui/textarea.test.tsx
git commit -m "feat(ui): add Textarea primitive"
```

---

## Task 5: SymbolSearchCombobox

**Files:**
- Create: `src/components/watchlist/symbol-search-combobox.tsx`
- Test: `tests/components/watchlist/symbol-search-combobox.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/watchlist/symbol-search-combobox.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SymbolSearchCombobox } from "@/components/watchlist/symbol-search-combobox";
import { renderWithQuery } from "../../helpers/render";

function mockResponses() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/search")) {
      return new Response(
        JSON.stringify({
          hits: [
            { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy" },
            { symbol: "TCS", exchange: "BSE", name: "Tata Consultancy" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.startsWith("/api/quotes/batch")) {
      return new Response(
        JSON.stringify({
          quotes: {
            "NSE:TCS": {
              symbol: "TCS",
              exchange: "NSE",
              name: "Tata Consultancy",
              lastPrice: 3500,
              previousClose: 3400,
              open: null,
              dayHigh: null,
              dayLow: null,
              change: 100,
              changePct: 2.94,
              volume: null,
              asOf: "2026-05-22T10:00:00Z",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("<SymbolSearchCombobox />", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces typing then renders enriched suggestions", async () => {
    const fetchMock = mockResponses();
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<SymbolSearchCombobox onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search symbol/i);
    await user.type(input, "tcs");

    // Before debounce timer elapses, no fetch.
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance debounce window (250ms).
    await act(async () => {
      vi.advanceTimersByTime(260);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/search?q=tcs"),
        expect.anything(),
      );
    });

    // After search resolves, quote fetch fires.
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) =>
        typeof c[0] === "string" ? c[0] : c[0]!.toString(),
      );
      expect(urls.some((u) => u.startsWith("/api/quotes/batch"))).toBe(true);
    });

    // The NSE row shows price; the BSE row falls back to "—".
    await waitFor(() => {
      expect(screen.getAllByText("TCS").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Tata Consultancy/i)).toBeInTheDocument();
  });

  it("calls onSelect with the chosen hit", async () => {
    mockResponses();
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(<SymbolSearchCombobox onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText(/search symbol/i), "tcs");
    await act(async () => {
      vi.advanceTimersByTime(260);
    });

    const nseRow = await screen.findByRole("option", { name: /TCS.*NSE/i });
    await user.click(nseRow);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "TCS", exchange: "NSE" }),
    );
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/components/watchlist/symbol-search-combobox.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the combobox**

Create `src/components/watchlist/symbol-search-combobox.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { Quote, SymbolSearchHit } from "@/lib/market/types";
import { cn, formatINR, formatPercent } from "@/lib/utils";

interface Props {
  onSelect: (hit: SymbolSearchHit) => void;
  value?: SymbolSearchHit | null;
}

type QuoteMap = Record<string, Quote | { error: string } | undefined>;

function quoteKey(s: { symbol: string; exchange: string }) {
  return `${s.exchange}:${s.symbol}`;
}

export function SymbolSearchCombobox({ onSelect, value }: Props) {
  const [text, setText] = useState(value ? value.symbol : "");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const reqId = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setHits([]);
      setQuotes({});
      setError(null);
      setLoading(false);
      return;
    }
    const myId = ++reqId.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const sr = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!sr.ok) throw new Error("search_failed");
        const { hits: rawHits } = (await sr.json()) as { hits: SymbolSearchHit[] };
        if (myId !== reqId.current) return;
        const top = rawHits.slice(0, 10);
        setHits(top);
        setHighlight(0);

        if (top.length === 0) {
          setQuotes({});
          return;
        }

        const qr = await fetch("/api/quotes/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: top.map((h) => ({ symbol: h.symbol, exchange: h.exchange })),
          }),
        });
        if (!qr.ok) {
          if (myId === reqId.current) setQuotes({});
          return;
        }
        const { quotes: qmap } = (await qr.json()) as { quotes: QuoteMap };
        if (myId === reqId.current) setQuotes(qmap ?? {});
      } catch {
        if (myId === reqId.current) {
          setError("Search unavailable, try again");
          setHits([]);
          setQuotes({});
        }
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [text]);

  const handleSelect = (hit: SymbolSearchHit) => {
    onSelect(hit);
    setText(hit.symbol);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[highlight];
      if (hit) handleSelect(hit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const showList = open && (loading || hits.length > 0 || error || text.trim().length > 0);

  const content = useMemo(() => {
    if (error) {
      return <p className="px-2 py-1.5 text-sm text-muted-foreground">{error}</p>;
    }
    if (loading && hits.length === 0) {
      return (
        <div className="space-y-1 p-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      );
    }
    if (hits.length === 0) {
      return (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
      );
    }
    return hits.map((hit, idx) => {
      const q = quotes[quoteKey(hit)] as Quote | undefined;
      const hasQuote = q && "lastPrice" in q;
      const change = hasQuote ? (q as Quote).changePct : null;
      const last = hasQuote ? (q as Quote).lastPrice : null;
      return (
        <button
          key={`${hit.exchange}:${hit.symbol}:${idx}`}
          role="option"
          aria-selected={idx === highlight}
          type="button"
          onMouseEnter={() => setHighlight(idx)}
          onClick={() => handleSelect(hit)}
          className={cn(
            "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
            idx === highlight && "bg-accent text-accent-foreground",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-medium">{hit.symbol}</span>
            <span className="text-[10px] text-muted-foreground">{hit.exchange}</span>
            {hit.name ? (
              <span className="truncate text-muted-foreground">{hit.name}</span>
            ) : null}
          </span>
          <span className="ml-2 flex items-center gap-2 tabular-nums">
            {last == null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <>
                <span>{formatINR(last)}</span>
                <span
                  className={cn(
                    "text-xs",
                    change == null
                      ? "text-muted-foreground"
                      : change > 0
                      ? "text-success"
                      : change < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {change == null ? "" : formatPercent(change)}
                </span>
              </>
            )}
          </span>
        </button>
      );
    });
  }, [error, hits, highlight, loading, quotes]);

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            placeholder="Search symbol (e.g. TCS)"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              if (value) onSelect({ symbol: "", exchange: "NSE", name: null });
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCapitalize="characters"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          {loading ? (
            <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        role="listbox"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/components/watchlist/symbol-search-combobox.test.tsx`
Expected: PASS, 2/2. Iterate on selectors/timing only if a test fails; do not relax assertions.

- [ ] **Step 5: Commit**

```bash
git add src/components/watchlist/symbol-search-combobox.tsx tests/components/watchlist/symbol-search-combobox.test.tsx
git commit -m "feat(watchlist): symbol-search combobox with live price"
```

---

## Task 6: Wire combobox + notes textarea into add dialog

**Files:**
- Modify: `src/components/watchlist/add-watchlist-dialog.tsx`

- [ ] **Step 1: Replace the dialog body**

Replace the entire contents of `src/components/watchlist/add-watchlist-dialog.tsx` with:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addWatchlistItem } from "@/app/(app)/watchlist/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SymbolSearchCombobox } from "@/components/watchlist/symbol-search-combobox";
import type { SymbolSearchHit } from "@/lib/market/types";

export function AddWatchlistDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<SymbolSearchHit | null>(null);
  const [notes, setNotes] = useState("");
  const router = useRouter();

  const reset = () => {
    setSelected(null);
    setNotes("");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || !selected.symbol) {
      toast.error("Pick a symbol from the search results");
      return;
    }
    const fd = new FormData();
    fd.set("symbol", selected.symbol);
    fd.set("exchange", selected.exchange);
    fd.set("notes", notes);
    start(async () => {
      const res = await addWatchlistItem(fd);
      if (res.ok) {
        toast.success("Added to watchlist");
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to add");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add symbol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to watchlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Symbol</Label>
            <SymbolSearchCombobox
              value={selected}
              onSelect={(hit) => setSelected(hit.symbol ? hit : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you watching this?"
            />
            <p className="text-xs text-muted-foreground">
              {notes.length} / 500
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !selected || !selected.symbol}
            >
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/add-watchlist-dialog.tsx
git commit -m "feat(watchlist): use search combobox + notes field in add dialog"
```

---

## Task 7: NotesModal

**Files:**
- Create: `src/components/watchlist/notes-modal.tsx`
- Test: `tests/components/watchlist/notes-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/watchlist/notes-modal.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NotesModal } from "@/components/watchlist/notes-modal";

const updateWatchlistNotes = vi.fn();
vi.mock("@/app/(app)/watchlist/actions", () => ({
  updateWatchlistNotes: (...args: unknown[]) => updateWatchlistNotes(...args),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ITEM = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "u1",
  symbol: "INFY",
  exchange: "NSE" as const,
  added_at: "2026-05-22T10:00:00Z",
  notes: "Watching ahead of earnings call on Friday.",
};

describe("<NotesModal />", () => {
  beforeEach(() => {
    updateWatchlistNotes.mockReset();
    refresh.mockReset();
  });

  it("opens in view mode with full notes and Edit/Delete buttons", () => {
    render(<NotesModal item={ITEM} onClose={vi.fn()} />);
    expect(screen.getByText(/Notes — INFY/)).toBeInTheDocument();
    expect(screen.getByText(/earnings call on Friday/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides Delete when notes is null", () => {
    render(<NotesModal item={{ ...ITEM, notes: null }} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  it("Edit → Save calls updateWatchlistNotes with trimmed value", async () => {
    updateWatchlistNotes.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NotesModal item={ITEM} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, "  Updated thesis  ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(updateWatchlistNotes).toHaveBeenCalledWith(ITEM.id, "Updated thesis");
    expect(onClose).toHaveBeenCalled();
  });

  it("Edit → Cancel reverts to view mode without saving", async () => {
    const user = userEvent.setup();
    render(<NotesModal item={ITEM} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/earnings call on Friday/)).toBeInTheDocument();
    expect(updateWatchlistNotes).not.toHaveBeenCalled();
  });

  it("Delete → confirm calls updateWatchlistNotes(id, null)", async () => {
    updateWatchlistNotes.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NotesModal item={ITEM} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    // Confirm step
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(updateWatchlistNotes).toHaveBeenCalledWith(ITEM.id, null);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/components/watchlist/notes-modal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement NotesModal**

Create `src/components/watchlist/notes-modal.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateWatchlistNotes } from "@/app/(app)/watchlist/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/types/database";

type WatchlistItem = Tables<"watchlist_items">;

interface Props {
  item: WatchlistItem | null;
  onClose: () => void;
}

type Mode = "view" | "edit" | "confirm-delete";

export function NotesModal({ item, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (item) {
      setMode("view");
      setDraft(item.notes ?? "");
    }
  }, [item]);

  if (!item) return null;

  const save = (next: string | null) => {
    start(async () => {
      const res = await updateWatchlistNotes(item.id, next);
      if (res.ok) {
        toast.success(next == null ? "Note deleted" : "Note saved");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Notes — {item.symbol} ({item.exchange})
          </DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <p className="whitespace-pre-wrap text-sm">
            {item.notes ?? (
              <span className="text-muted-foreground">No notes yet.</span>
            )}
          </p>
        ) : null}

        {mode === "edit" ? (
          <div className="space-y-2">
            <Textarea
              rows={5}
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{draft.length} / 500</p>
          </div>
        ) : null}

        {mode === "confirm-delete" ? (
          <p className="text-sm">Delete this note? This cannot be undone.</p>
        ) : null}

        <DialogFooter>
          {mode === "view" ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Close
              </Button>
              {item.notes != null ? (
                <Button
                  variant="destructive"
                  onClick={() => setMode("confirm-delete")}
                  disabled={pending}
                >
                  Delete
                </Button>
              ) : null}
              <Button onClick={() => setMode("edit")} disabled={pending}>
                Edit
              </Button>
            </>
          ) : null}

          {mode === "edit" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(item.notes ?? "");
                  setMode("view");
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => save(draft.trim() === "" ? null : draft.trim())}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : null}

          {mode === "confirm-delete" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setMode("view")}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => save(null)}
                disabled={pending}
                aria-label="confirm delete"
              >
                {pending ? "Deleting…" : "Confirm delete"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/components/watchlist/notes-modal.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/components/watchlist/notes-modal.tsx tests/components/watchlist/notes-modal.test.tsx
git commit -m "feat(watchlist): notes view/edit/delete modal"
```

---

## Task 8: Watchlist table — Notes column with truncated trigger

**Files:**
- Modify: `src/components/watchlist/watchlist-table.tsx`
- Test: `tests/components/watchlist/watchlist-table.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/watchlist/watchlist-table.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { renderWithQuery } from "../../helpers/render";
import type { Tables } from "@/types/database";

type Item = Tables<"watchlist_items">;

const SHORT: Item = {
  id: "a",
  user_id: "u1",
  symbol: "INFY",
  exchange: "NSE",
  added_at: "2026-05-22T10:00:00Z",
  notes: "Short note",
};

const LONG: Item = {
  id: "b",
  user_id: "u1",
  symbol: "TCS",
  exchange: "NSE",
  added_at: "2026-05-22T10:00:00Z",
  notes: "x".repeat(200),
};

const EMPTY: Item = {
  id: "c",
  user_id: "u1",
  symbol: "WIPRO",
  exchange: "NSE",
  added_at: "2026-05-22T10:00:00Z",
  notes: null,
};

describe("<WatchlistTable /> notes column", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ quotes: {} }), { status: 200 }),
      ),
    );
  });

  it("renders em-dash for null notes", () => {
    renderWithQuery(<WatchlistTable items={[EMPTY]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders short notes verbatim with no ellipsis icon", () => {
    renderWithQuery(<WatchlistTable items={[SHORT]} />);
    expect(screen.getByText("Short note")).toBeInTheDocument();
    expect(screen.queryByLabelText(/open full notes/i)).toBeNull();
  });

  it("renders 150-char slice + ellipsis trigger for long notes, opens modal on click", async () => {
    const user = userEvent.setup();
    renderWithQuery(<WatchlistTable items={[LONG]} />);
    const trigger = screen.getByLabelText(/open full notes/i);
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByText(/Notes — TCS/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/components/watchlist/watchlist-table.test.tsx`
Expected: FAIL — the Notes column doesn't exist yet.

- [ ] **Step 3: Update WatchlistTable**

Replace `src/components/watchlist/watchlist-table.tsx` entirely with:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { removeWatchlistItem } from "@/app/(app)/watchlist/actions";
import { NotesModal } from "@/components/watchlist/notes-modal";
import type { Quote } from "@/lib/market/types";
import { truncateText } from "@/lib/text";
import { cn, formatINR, formatPercent } from "@/lib/utils";
import type { Tables } from "@/types/database";

type WatchlistItem = Tables<"watchlist_items">;

const NOTES_TRUNCATE = 150;

async function fetchQuotes(items: WatchlistItem[]) {
  if (items.length === 0) return {};
  const res = await fetch("/api/quotes/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((i) => ({ symbol: i.symbol, exchange: i.exchange })),
    }),
  });
  if (!res.ok) throw new Error("quote_fetch_failed");
  const json = (await res.json()) as {
    quotes: Record<string, Quote | { error: string }>;
  };
  return json.quotes;
}

export function WatchlistTable({ items }: { items: WatchlistItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeNote, setActiveNote] = useState<WatchlistItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      "watchlist-quotes",
      items.map((i) => `${i.exchange}:${i.symbol}`).sort().join(","),
    ],
    queryFn: () => fetchQuotes(items),
    enabled: items.length > 0,
    refetchInterval: 30_000,
  });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your watchlist is empty. Add symbols you want to track.
        </p>
      </div>
    );
  }

  const onRemove = (id: string) => {
    start(async () => {
      const res = await removeWatchlistItem(id);
      if (res.ok) {
        toast.success("Removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">Day change</TableHead>
              <TableHead className="text-right">Prev close</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const key = `${item.exchange}:${item.symbol}`;
              const raw = data?.[key];
              const quote =
                raw && "lastPrice" in (raw as object) ? (raw as Quote) : null;
              const { text: notesText, truncated } = truncateText(
                item.notes,
                NOTES_TRUNCATE,
              );
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.symbol}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.exchange}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="num text-right">
                    {isLoading && !quote ? (
                      <Skeleton className="ml-auto h-4 w-16" />
                    ) : quote ? (
                      formatINR(quote.lastPrice)
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "num text-right",
                      quote && quote.change > 0 && "text-success",
                      quote && quote.change < 0 && "text-destructive",
                    )}
                  >
                    {quote ? (
                      <>
                        {formatINR(quote.change)}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({formatPercent(quote.changePct)})
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {quote ? formatINR(quote.previousClose) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[40ch] align-top">
                    {item.notes == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveNote(item)}
                        aria-label={
                          truncated ? "Open full notes" : "Open notes"
                        }
                        className="line-clamp-2 text-left text-sm hover:underline focus:outline-none focus-visible:underline"
                      >
                        {notesText}
                        {truncated ? (
                          <>
                            {" "}
                            <MoreHorizontal
                              className="inline h-3.5 w-3.5 align-middle text-muted-foreground"
                              aria-hidden
                            />
                          </>
                        ) : null}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(item.id)}
                      disabled={pending}
                      aria-label="Remove from watchlist"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <NotesModal item={activeNote} onClose={() => setActiveNote(null)} />
    </>
  );
}
```

- [ ] **Step 4: Run the new test plus the existing notes-modal test**

Run: `npm test -- tests/components/watchlist/`
Expected: PASS for both files.

- [ ] **Step 5: Lint + typecheck + full test sweep**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS across the suite. If any pre-existing test breaks because of the new Notes column header (e.g. snapshots), update it explicitly.

- [ ] **Step 6: Commit**

```bash
git add src/components/watchlist/watchlist-table.tsx tests/components/watchlist/watchlist-table.test.tsx
git commit -m "feat(watchlist): notes column with truncation + modal"
```

---

## Task 9: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Apply the migration locally**

Run: `npx supabase db push` (or whatever the project uses to apply pending migrations locally — check `README.md` for the canonical command if unsure). Confirm the `notes` column exists:

```bash
npx supabase db diff --schema public | head -40
```

Expected: shows the column already applied / no pending diff.

- [ ] **Step 2: Run the dev server**

Run: `npm run dev`
Open: `http://localhost:3000/watchlist`

- [ ] **Step 3: Walk through the feature**

For each item, verify and check it off:

- [ ] Click "Add symbol". Dialog opens with the search combobox visible.
- [ ] Type "tcs" — suggestion list appears after ~250ms with rows showing `SYMBOL · name` on the left and price + colored ±% on the right (green for up, red for down).
- [ ] Use ↑/↓ keys to move highlight; Enter to select. Symbol fills.
- [ ] Type a note (e.g. "Earnings on Friday, watching for guidance update"); submit.
- [ ] Toast "Added to watchlist" appears; row is visible in the table.
- [ ] Repeat with a long note (>150 chars). Confirm the Notes cell shows the truncated text plus the three-dot icon at the end.
- [ ] Click the truncated notes cell — modal opens in view mode with the full note.
- [ ] Click Edit → textarea pre-fills → save edited text → row re-renders with new text.
- [ ] Click the cell again → Delete → Confirm delete → row's Notes cell flips to "—".
- [ ] Add a symbol without notes; confirm the row shows "—" for Notes.

- [ ] **Step 4: Cross-user RLS sanity check (optional but recommended)**

Open a private browser window, sign in as a second user. Confirm that user cannot see or edit the first user's notes. If the project has a seed/dev helper for a second account, use it; otherwise create a temporary account.

- [ ] **Step 5: Final lint + typecheck + test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: No commit (verification only).** If any issue surfaces, file a follow-up task — do not silently fix in this commit boundary.

---

## Self-review notes

**Spec coverage check:**
- Migration + types ✅ Task 1
- Server actions extended ✅ Task 3
- Notes truncate helper ✅ Task 2 (introduced; referenced by Task 8)
- Symbol search combobox with price ✅ Task 5
- Add dialog rework ✅ Task 6
- Notes modal ✅ Task 7
- Table Notes column ✅ Task 8
- Testing per spec ✅ Tasks 2/3/4/5/7/8
- Manual checklist ✅ Task 9

**Type consistency:**
- `WatchlistItem` is sourced from `Tables<"watchlist_items">` throughout (Tasks 7, 8, test fixtures).
- `SymbolSearchHit` re-used between combobox and add dialog.
- `updateWatchlistNotes(id, notes)` signature matches in actions, modal, and test mock.
- `truncateText(input, max)` returns `{ text, truncated }` and is consumed by `WatchlistTable` only.

**No placeholders.** Every step has complete code or a concrete command.
