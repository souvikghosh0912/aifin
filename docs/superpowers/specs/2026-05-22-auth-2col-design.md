# Auth page — 2-column refinement

**Date:** 2026-05-22
**Scope:** `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
**Status:** spec → plan

## Context

The working tree already has a 2-column auth layout in progress (form left, marketing-style highlight panel right with four feature cards). The committed `HEAD` is still the original single-column centered layout. This spec defines the *target* 2-column design we want to land — a refined version of what's in the working tree — and the deltas needed to get there.

The app follows compact, finance-first UI conventions captured in `UI.md`: no marketing copy in app surfaces, no SaaS-card feel, hairline borders, no gradients/shadows, `h-12` chrome, `p-4` panels, `text-lg font-semibold tracking-tight` H1s.

## Goals

- Two-column layout: form left, panel right, `lg:grid-cols-2`.
- Panel reads like the app, not like a landing page.
- No marketing headline or descriptive paragraph in the panel.
- Feature highlights present as a single unified data block, not four floating cards.
- Mobile renders form-only (right panel hidden below `lg`).

## Non-goals

- No product-preview / mock-dashboard rendering in the right column.
- No gradients, patterns, glow, or `backdrop-blur-*`.
- No mobile-specific surface for the right panel.
- No changes to auth server actions (`src/app/(auth)/actions.ts`) or form submission wiring.
- No change to the brand identity (logo glyph, name, tagline copy beyond what's listed below).

## Files changed

| File | Change |
|---|---|
| `src/app/(auth)/layout.tsx` | Refine right column: replace four `border bg-card` cards with one unified divided block; update header chip; drop marketing headline + paragraph; add section eyebrow. |
| `src/app/(auth)/login/page.tsx` | Tighten `space-y-6` → `space-y-5` between H1 block and form. Cross-link styling: drop default underline, soften foreground. |
| `src/app/(auth)/signup/page.tsx` | Same tightening + cross-link styling as login. |

No new files. No new dependencies.

## Layout shell (`(auth)/layout.tsx`)

Top-level: `grid min-h-screen bg-background lg:grid-cols-2` (unchanged).

Left column (form):
- Header `h-12 border-b px-4 lg:px-6` — `finai` brand mark on the left, `ThemeToggle` on the right (unchanged from working tree).
- Main: `flex flex-1 items-center justify-center px-4 py-8 lg:px-10`. Child content wrapped in `w-full max-w-sm` (unchanged).

Right column (panel) — `aside` with `relative hidden flex-col border-l lg:flex`:

### Right header (`h-12 border-b px-6`)
- **Left**: existing AI pill — `inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground` with `Sparkles h-3 w-3 text-foreground` and text "AI-native portfolio analytics".
- **Right**: replace plain text "for Indian markets" with a chip — `inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground` with text "NSE & BSE". Same hairline-chip language as the left pill, slightly quieter background.

### Right body (`flex flex-1 flex-col justify-center gap-5 px-6 py-10 lg:px-10`)
- **Section eyebrow** above the grid: `<h2>` styled `text-xs font-semibold uppercase tracking-wider text-muted-foreground` with text "What's inside". UI.md's canonical panel-header style.
- **Unified feature block** — single container:
  ```
  <div class="grid grid-cols-2 overflow-hidden rounded-lg border bg-card">
    {/* 4 cells, hairline dividers via border classes per cell */}
  </div>
  ```
  Each cell: `flex flex-col gap-2 p-4`, with right-border on left column cells and bottom-border on top row cells to form internal hairlines. (Concrete pattern: cell index 0 gets `border-b border-r`, 1 gets `border-b`, 2 gets `border-r`, 3 gets nothing — or equivalently use `divide-x divide-y` on the wrapper if we render a single grid.)
- **Cell content** (same data as the existing `HIGHLIGHTS` array — title, description, icon):
  - Icon chip: `grid h-7 w-7 place-items-center rounded-md bg-muted text-foreground`, icon `h-4 w-4` (lucide, outline).
  - Title: `text-sm font-medium`.
  - Description: `text-xs leading-snug text-muted-foreground`.
- **No hover lift, no shadow, no transition** on the cells. Flat.

### Right footer (`h-12 border-t px-6`)
- Left: `© {year} finai` — `text-xs text-muted-foreground`.
- Right: `Market data via {bold} nse-bse-api {/bold}` — `text-xs text-muted-foreground` with the API name `font-medium text-foreground`. (Unchanged from working tree.)

## Form pages (`login/page.tsx`, `signup/page.tsx`)

Both pages keep their current structure (Suspense wrapper on login, server-action via `useActionState`, `signIn` / `signUp` from `../actions`). Only visual touches:

1. Outer container: `space-y-6` → `space-y-5`. Tightens the H1-to-form gap to UI.md's denser rhythm.
2. Cross-link line at the bottom: keep current copy. Change the inline `<Link>` from `font-medium text-foreground hover:underline` to `font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline`. Quieter at rest, clearer affordance on hover.

No copy changes to headings, labels, placeholders, button text, or error/info messages.

## Data / behavior

No data flow changes. The `HIGHLIGHTS` array in `layout.tsx` stays the same (4 entries: TrendingUp, BarChart3, Bot, Shield). Server actions, redirect query param handling, and pending state behavior are untouched.

## Verification

After implementation:
1. `npm run dev` (project uses npm; `next dev` under the hood) and open `/login` and `/signup` in a browser at viewport widths `lg` (≥1024px) and below.
2. Visual checks:
   - At `lg` and above: 2-column with form left, panel right.
   - Below `lg`: form only, no panel artifacts.
   - Form column header (`h-12`) and panel header bar align horizontally; same for the bottom edges with the panel footer (`h-12`).
   - Feature block reads as one rounded container with internal hairlines, not four floating cards.
   - No hover lift / shadow / blur on the panel.
   - Dark mode: hairlines, chip backgrounds, and muted text remain readable; no inverted-color glitches.
3. Functional checks:
   - Submit invalid creds on `/login` → error renders below form.
   - Submit valid signup payload → `info` state renders confirmation block.
   - Cross-links navigate between `/login` and `/signup`.
   - `?redirect=` query param round-trips through the login form's hidden input.

## Out of scope (explicit)

- Restyling the dashboard, sidebar, or any post-auth surface.
- Adding analytics, third-party SSO, or password-reset flows.
- Building a mobile-specific marketing surface.
- Changing the brand glyph (`₹` in a primary tile) or product name.
