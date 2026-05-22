# Watchlist — symbol-search suggestions & notes

**Date:** 2026-05-22
**Scope:** `src/app/(app)/watchlist/*`, `src/components/watchlist/*`, `supabase/migrations/*`, `src/types/database.ts`
**Status:** spec → plan

## Context

The watchlist currently uses plain `<Input>` for symbol and a `<Select>` for exchange in `src/components/watchlist/add-watchlist-dialog.tsx`. There is no autocomplete, no live price preview in the add flow, and no per-row notes capability. We already have a `/api/search` route backed by `searchSymbols()` (returns `{symbol, exchange, name}` only) and a `/api/quotes/batch` route used by the watchlist table's polling. RLS scopes `watchlist_items` to `auth.uid() = user_id`.

This spec adds:
1. A symbol-search combobox in the add dialog with live price + day-change indicator in each suggestion.
2. An optional notes field captured during add.
3. A "Notes" column on the watchlist table with character-based truncation and a modal for viewing, editing, and deleting the full note.

## Goals

- Replace the symbol input in the add dialog with a debounced searchable combobox that displays `SYMBOL • name` and `LTP • ±change%` (colored) for each suggestion.
- Add a 500-character notes textarea to the add dialog.
- Persist notes on `watchlist_items` via a new nullable column.
- Render a Notes column in the watchlist table: `—` when null, up to 150 characters then a `…` button when longer.
- Provide a notes modal that opens in read-only view with `Edit` and `Delete` actions, switching to a textarea for edits.

## Non-goals

- No markdown or rich text in notes (plain text only, `whitespace-pre-wrap` for rendering).
- No search/filter of the watchlist by notes content.
- No notes audit history.
- No bulk notes editing.
- No pagination of search suggestions (capped client-side at 10).
- No changes to the existing watchlist polling, quote cache, or RLS policies.
- No new UI primitive library; reuse Radix/shadcn components already in `src/components/ui`.

## Files changed

**New**
- `supabase/migrations/0002_watchlist_notes.sql` — adds `notes text` column with `CHECK (notes IS NULL OR char_length(notes) <= 500)`.
- `src/components/watchlist/symbol-search-combobox.tsx` — debounced combobox with price enrichment.
- `src/components/watchlist/notes-modal.tsx` — view/edit/delete modal.

**Modified**
- `src/app/(app)/watchlist/actions.ts` — extend Zod schema to accept `notes`; add `updateWatchlistNotes(id, notes)` server action.
- `src/components/watchlist/add-watchlist-dialog.tsx` — replace symbol input with combobox; add notes textarea.
- `src/components/watchlist/watchlist-table.tsx` — add Notes column, "…" trigger, modal state plumbing.
- `src/types/database.ts` — regenerated via `npm run db:types` to include `notes: string | null` on `watchlist_items`.

## Data model

```sql
-- 0002_watchlist_notes.sql
ALTER TABLE watchlist_items
  ADD COLUMN notes text;

ALTER TABLE watchlist_items
  ADD CONSTRAINT watchlist_items_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 500);
```

- `notes` is nullable. `NULL` means "no note" and is the default for existing rows and new rows that omit it.
- Empty strings submitted from the client are normalized to `NULL` by the server action before insert/update.
- RLS unchanged: the existing `auth.uid() = user_id` policy on `watchlist_items` covers `SELECT`, `UPDATE`, `DELETE` for notes.

## Server actions

`src/app/(app)/watchlist/actions.ts` exports two additions / changes:

```ts
// existing, extended
const addSchema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["NSE", "BSE"]),
  notes: z.string().max(500).optional().nullable(),
});

// new
export async function updateWatchlistNotes(
  itemId: string,
  notes: string | null,
): Promise<{ ok: boolean; error?: string }>;
```

Behavior:
- `addWatchlistItem` — accepts `notes` from `FormData`; empty string → `null`; trims whitespace before length check.
- `updateWatchlistNotes` — Zod-validates id (uuid) and notes (≤500 chars or null); runs `UPDATE watchlist_items SET notes = $1 WHERE id = $2 AND user_id = auth.uid()`; calls `revalidatePath('/watchlist')`; returns `{ ok }` on success and `{ ok: false, error }` on validation or DB failure.
- Passing `null` to `updateWatchlistNotes` is the delete path.

## UI components

### `SymbolSearchCombobox`

- Props: `onSelect({symbol, exchange}: SymbolSearchHit) => void`, `value?: SymbolSearchHit | null`.
- Renders a controlled `<Input>` and a Radix `Popover` listbox below it.
- 250ms debounce on the query. Effect chain:
  1. `GET /api/search?q=...` → `SymbolSearchHit[]`.
  2. If hits non-empty, `POST /api/quotes/batch` with the hits' `{symbol, exchange}` pairs.
  3. Merge quotes by `${exchange}:${symbol}` key. Hits without a matching quote render price as `—`.
- Each suggestion row:
  - Left: `<span class="font-medium">SYMBOL</span> · <span class="text-muted-foreground">name</span>`.
  - Right: `<span>LTP</span> <span class="text-success | text-destructive">±change%</span>`.
- States: loading (skeleton rows), empty ("No matches"), error ("Search unavailable").
- Keyboard: ↑/↓ to move highlight, Enter to select, Esc to close. Powered by Radix Popover + manual keydown handlers on the input.
- Cap rendered suggestions at 10 client-side.
- After selection, the input shows the selected symbol and the popover closes. Editing the input clears the selection and reopens search.

### `AddWatchlistDialog` (modified)

- Replace the symbol `<Input>` + exchange `<Select>` pair with `<SymbolSearchCombobox />`.
- Maintain hidden `<input name="symbol">` and `<input name="exchange">` fields that mirror the combobox selection so the existing FormData flow keeps working.
- Add below the combobox:
  ```tsx
  <Label htmlFor="notes">Notes (optional)</Label>
  <textarea
    id="notes"
    name="notes"
    rows={3}
    maxLength={500}
    className="..."
  />
  <p class="text-xs text-muted-foreground">{value.length} / 500</p>
  ```
- Submit button is disabled until a symbol is selected (i.e., hidden `symbol` input has a value).

### `WatchlistTable` (modified)

- New column header `Notes` inserted between `Prev close` and the existing delete action column.
- Cell renderer per row:
  - `notes == null` → `<span class="text-muted-foreground">—</span>`. Not clickable.
  - `notes.length <= 150` → `<button type="button" class="text-left text-sm">{notes}</button>`. Whole text is the modal trigger. No 3-dot icon.
  - `notes.length > 150` → `<button type="button" class="text-left text-sm">{notes.slice(0, 150)} <MoreHorizontal class="inline h-3.5 w-3.5" /></button>`. The button is the truncated text plus the 3-dot icon at the end.
- Cell wrapping: `max-w-[40ch]` with `line-clamp-2` so the row visually caps at two lines but the 150-char truncation remains the authoritative cut-off. No CSS-level `truncate` (would conflict with the explicit slice).
- Local state: `const [activeNote, setActiveNote] = useState<WatchlistItem | null>(null)`. Clicking the cell button calls `setActiveNote(row)`.
- `<NotesModal item={activeNote} onClose={() => setActiveNote(null)} />` rendered once at table root.

### `NotesModal`

- Props: `item: WatchlistItem | null`, `onClose: () => void`. Dialog open is derived from `item != null`.
- Header title: `Notes — {item.symbol} ({item.exchange})`.
- Two internal modes: `"view" | "edit"`. Always opens in `"view"`.
- **View mode**
  - Body: `<p class="whitespace-pre-wrap text-sm">{item.notes ?? "No notes yet."}</p>`.
  - Footer: `Close` (ghost), `Delete` (destructive — only shown when `item.notes != null`), `Edit`.
- **Edit mode**
  - Body: `<textarea>` pre-filled with `item.notes ?? ""`, `maxLength=500`, char counter underneath.
  - Footer: `Cancel` (returns to view mode without saving), `Save`.
  - `Save` calls `updateWatchlistNotes(item.id, value.trim() || null)`.
- **Delete confirm**
  - Triggered by `Delete` in view mode. Renders inline confirm row: "Delete this note?" with `Cancel` and a destructive `Delete` button.
  - Confirming calls `updateWatchlistNotes(item.id, null)`.
- On any successful mutation: `toast.success`, `router.refresh()`, `onClose()`.
- On failure: `toast.error(res.error)` and remain in the current mode so the user can retry.

## Data flow

**Add path**
1. User opens dialog, types into combobox.
2. After 250ms idle, client fires `GET /api/search?q=...`.
3. Client fires `POST /api/quotes/batch` for returned hits, merges by key.
4. Suggestion list renders with LTP and colored change%.
5. User selects → hidden `symbol`/`exchange` populate; submit enables.
6. User optionally types notes (≤500), submits.
7. `addWatchlistItem(formData)` validates, inserts `{user_id, symbol, exchange, notes}`.
8. Toast success → `router.refresh()` → new row appears with notes.

**Edit / delete path**
1. Clicking the truncated notes text or "…" button calls `setActiveNote(row)`.
2. Modal opens in view mode showing the full note.
3. `Edit` → textarea pre-filled → `Save` → `updateWatchlistNotes(id, value)` → revalidate → close → row's truncated cell updates.
4. `Delete` → confirm → `updateWatchlistNotes(id, null)` → revalidate → row's cell flips to `—`.

## Error handling

- `/api/search` 4xx/5xx → suggestion list shows "Search unavailable, try again". The form does not block — the user can still pick another search query.
- `/api/quotes/batch` partial failure → per-symbol fallback: that row's price/change render as `—`. Whole list is never blocked by one bad quote.
- Server actions return `{ ok: false, error }` — the dialog and modal show `toast.error(error)`.
- Notes length is defended at three layers: client `maxLength` (UX), Zod (server), `CHECK` constraint (database).
- Concurrent edits: last write wins. No optimistic locking — out of scope.

## Testing

Existing stack: Vitest + React Testing Library; tests live under `tests/`.

- **Unit** — Zod schema in `actions.ts` accepts: notes empty, notes null, notes ≤500. Rejects notes >500.
- **Unit** — `truncate(text, 150)` helper (introduced for the cell renderer): returns full text when shorter, returns `slice(0,150)+"…"` when longer; idempotent on already-short input.
- **Unit** — `SymbolSearchCombobox` debounces calls to the search API (fake timers, advance 250ms).
- **Component** — `WatchlistTable` renders `—` for null notes; renders truncated text + "…" button for >150-char notes; clicking the button opens the modal.
- **Component** — `NotesModal` opens in view mode, switching to edit shows textarea pre-filled; cancel restores view mode without saving.
- **Server action** — `updateWatchlistNotes` rejects writes to items the user does not own (RLS smoke test via the test Supabase client).
- **Manual checklist** added to PR description:
  1. Add a symbol via search → suggestions show price + change color.
  2. Add a symbol with notes → row appears with truncated notes.
  3. Click "…" → modal opens in view mode → edit, save → row updates.
  4. Open modal → delete → row's Notes cell shows `—`.
  5. Sign in as another user → cannot see or mutate the original user's notes via direct server-action invocation.

## Open questions

None at spec time. Implementation will surface details (exact Tailwind classes, Radix Popover trigger wiring) handled in the plan.
