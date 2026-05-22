# Auth page 2-column refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing 2-column auth layout to drop marketing copy, unify the feature highlights into a single divided block, and tighten form-page rhythm, per the spec at `docs/superpowers/specs/2026-05-22-auth-2col-design.md`.

**Architecture:** Three TSX files in `src/app/(auth)/`. No new files, no new dependencies, no test infrastructure changes. Two functional commits + one verification step. The right-column refactor in `layout.tsx` is the substantive change; the form-page edits are small class tweaks.

**Tech Stack:** Next.js 15 App Router (RSC + Client Components), Tailwind CSS 3.4, `lucide-react` icons, `cn()` from `@/lib/utils`.

**Testing strategy (why no RTL tests):** This repo has `vitest` + `@testing-library/react` configured but zero existing app tests. The change is pure layout/class adjustments with no logic delta. Standing up the first auth-page test fixture (mocking `next/navigation`, `next/link`, server actions) would be heavyweight for asserting "4 cells render" against a refactor that will adjust their classes again next time. Verification = `npm run typecheck`, `npm run lint`, and manual browser checks against the spec's visual checklist.

---

## File Structure

| File | Responsibility | Change type |
|---|---|---|
| `src/app/(auth)/layout.tsx` | The 2-column shell — left form column chrome + right marketing/highlights panel | Modify |
| `src/app/(auth)/login/page.tsx` | Sign-in form, server-action wiring | Modify (small) |
| `src/app/(auth)/signup/page.tsx` | Sign-up form, server-action wiring | Modify (small) |

No files created. No files deleted.

---

## Task 1: Right column refactor in `(auth)/layout.tsx`

**Files:**
- Modify: `src/app/(auth)/layout.tsx` (right `<aside>`, lines ~51–100 in working tree)

This task is one focused edit covering four sub-changes that all live in the right column:
- Swap the right-side text in the header bar for a hairline chip ("NSE & BSE").
- Drop the marketing headline + paragraph block from the body.
- Add a section eyebrow ("What's inside") above the feature grid.
- Replace the 4 separate `border bg-card` cards with a single rounded-lg bordered container subdivided by per-cell hairlines.

We do these in one commit because they're touching adjacent lines and any partial state is a regression (e.g., eyebrow present but cards still floating reads worse than either end state).

- [ ] **Step 1.1: Read the current file in full**

Use the `Read` tool on `src/app/(auth)/layout.tsx`. Confirm the file matches the structure described below before editing. The relevant region is the `<aside>` element (right column).

Current right column (working tree) — paraphrased structure:

```tsx
<aside className="relative hidden flex-col border-l lg:flex">
  <header className="flex h-12 items-center justify-between border-b px-6">
    <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Sparkles className="h-3 w-3 text-foreground" />
      AI-native portfolio analytics
    </div>
    <span className="text-[11px] text-muted-foreground">
      for Indian markets
    </span>
  </header>

  <div className="flex flex-1 flex-col justify-center gap-6 px-6 py-10 lg:px-10">
    <div className="space-y-2">
      <h2 className="max-w-md text-2xl font-semibold leading-tight tracking-tight">
        Your portfolio, understood.
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Track NSE & BSE holdings, log transactions, and let AI surface the
        signal in your portfolio.
      </p>
    </div>

    <div className="grid gap-2 sm:grid-cols-2">
      {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
        <div
          key={title}
          className="flex flex-col gap-2 rounded-lg border bg-card p-4"
        >
          <div className="grid h-7 w-7 place-items-center rounded-md bg-muted text-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>

  <footer className="flex h-12 items-center justify-between border-t px-6 text-xs text-muted-foreground">
    <span>© {new Date().getFullYear()} finai</span>
    <span>
      Market data via{" "}
      <span className="font-medium text-foreground">nse-bse-api</span>
    </span>
  </footer>
</aside>
```

Imports at top of file (current):

```tsx
import Link from "next/link";
import { BarChart3, Bot, Shield, Sparkles, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
```

- [ ] **Step 1.2: Add the `cn` import**

We need `cn` (from `@/lib/utils`) for per-cell conditional border classes in the unified feature block. Add it to the imports.

Edit the imports block to:

```tsx
import Link from "next/link";
import { BarChart3, Bot, Shield, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
```

(The blank line between third-party and `@/` imports follows the convention used elsewhere in this file — `next` / `lucide-react` are third-party, `@/...` are first-party.)

- [ ] **Step 1.3: Replace the right column header's right-side text with a chip**

In the right column's `<header>`, replace:

```tsx
    <span className="text-[11px] text-muted-foreground">
      for Indian markets
    </span>
```

with:

```tsx
    <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      NSE & BSE
    </span>
```

This is a hairline chip — same size language as the existing AI-native pill on the left, slightly quieter (`bg-muted/40` instead of `bg-card`) so it reads as a secondary chip, not a duplicate of the pill.

- [ ] **Step 1.4: Replace the body block — drop headline+paragraph, add eyebrow, unify feature grid**

Replace the entire body `<div>` (the one with `flex flex-1 flex-col justify-center gap-6 ...`) — i.e., everything between the right column's `</header>` and `<footer>` — with this single block:

```tsx
      <div className="flex flex-1 flex-col justify-center gap-5 px-6 py-10 lg:px-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What&apos;s inside
        </h2>

        <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card">
          {HIGHLIGHTS.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className={cn(
                "flex flex-col gap-2 p-4",
                i % 2 === 0 && "border-r",
                i < 2 && "border-b",
              )}
            >
              <div className="grid h-7 w-7 place-items-center rounded-md bg-muted text-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
```

Notes on the changes vs. the prior code:
- Outer wrapper container: `gap-6` → `gap-5` (matches UI.md's tighter rhythm).
- The marketing `<div className="space-y-2">` containing the H2 and `<p>` is gone.
- A new `<h2>` carries the section eyebrow style (UI.md's canonical panel-header convention).
- The 4 separate `rounded-lg border bg-card p-4` cards are replaced by ONE container with `rounded-lg border bg-card`, then 4 cells without their own border/bg, separated by per-cell `border-r` on left-column cells (indices 0, 2) and `border-b` on top-row cells (indices 0, 1). This produces the correct internal hairline cross.
- `overflow-hidden` on the wrapper hides cell borders that would otherwise poke past the rounded corner.
- The `&apos;` HTML entity is used in JSX because the unescaped apostrophe trips `react/no-unescaped-entities` in some lint configs; consistent with how the rest of the codebase handles it (verify locally — if other strings use a raw `'`, you may use a raw `'` here too).

The footer block stays unchanged.

- [ ] **Step 1.5: Run typecheck**

Run from the repo root:

```bash
npm run typecheck
```

Expected: no errors. If errors mention `cn`, confirm `@/lib/utils` exports it (it does — `cn` is the standard utility added by the shadcn init). If errors mention `HIGHLIGHTS` having unexpected typing for the index argument `i`, change `.map(({ icon: Icon, title, description }, i) =>` to `.map(({ icon: Icon, title, description }, i: number) =>` only if TS complains; otherwise leave the inferred number type.

- [ ] **Step 1.6: Run lint**

```bash
npm run lint
```

Expected: no new errors in `src/app/(auth)/layout.tsx`. If the lint config flags the raw apostrophe in `"What's inside"`, that's why Step 1.4 uses `&apos;`. If lint also flags the existing `&` in "Market data via..." that's pre-existing — leave it.

- [ ] **Step 1.7: Visual check (dev server)**

```bash
npm run dev
```

Open http://localhost:3000/login in a browser at viewport ≥ 1024px. Confirm:
- Top of right column: AI-native pill on left, "NSE & BSE" hairline chip on right.
- Body: small uppercase "WHAT'S INSIDE" label at the top.
- Below it: one rounded-corner bordered box, divided into 2x2 with single hairlines forming an internal cross. No 4 floating cards.
- Each cell: icon chip top-left, title, description.
- Footer: copyright left, "Market data via nse-bse-api" right.
- No hover lift, no shadow, no gradient, no blur on the panel.

Narrow the viewport below 1024px (`lg`). Confirm:
- Right column disappears entirely.
- Form column header still shows brand mark + theme toggle.

If anything looks off vs the spec, fix inline and re-run typecheck + lint before committing.

- [ ] **Step 1.8: Commit**

```bash
git add src/app/(auth)/layout.tsx
git commit -m "refactor(auth): unify feature highlights, drop marketing copy in right panel"
```

---

## Task 2: Form page tightening (`login/page.tsx`, `signup/page.tsx`)

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`

Two small class tweaks per file, applied identically:

1. Outer container `space-y-6` → `space-y-5`.
2. Cross-link styling: drop the default `hover:underline`-only behavior in favor of a quieter rest state with a slightly more prominent hover.

- [ ] **Step 2.1: Read both files**

`Read` `src/app/(auth)/login/page.tsx` and `src/app/(auth)/signup/page.tsx` to confirm structure.

- [ ] **Step 2.2: Edit `login/page.tsx`**

In `src/app/(auth)/login/page.tsx`, find:

```tsx
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
```

Change `space-y-6` → `space-y-5`:

```tsx
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
```

Then find the cross-link block:

```tsx
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground hover:underline"
        >
          Create an account
        </Link>
      </p>
```

Change the `<Link>` className from `font-medium text-foreground hover:underline` to `font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline`:

```tsx
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Create an account
        </Link>
      </p>
```

No other changes in this file.

- [ ] **Step 2.3: Edit `signup/page.tsx`**

In `src/app/(auth)/signup/page.tsx`, find:

```tsx
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">
          Create your account
        </h1>
```

Change `space-y-6` → `space-y-5`:

```tsx
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">
          Create your account
        </h1>
```

Then find the cross-link block:

```tsx
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline"
        >
          Sign in
        </Link>
      </p>
```

Change the `<Link>` className the same way:

```tsx
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Sign in
        </Link>
      </p>
```

No other changes in this file.

- [ ] **Step 2.4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.5: Run lint**

```bash
npm run lint
```

Expected: no new errors in either file.

- [ ] **Step 2.6: Visual check (dev server)**

If the dev server isn't already running: `npm run dev`. Open http://localhost:3000/login and http://localhost:3000/signup.

Confirm on both pages:
- The vertical gap between the H1+description block and the form is slightly tighter than before.
- The cross-link at the bottom of each form reads in muted gray at rest. Hover turns it to full-foreground with an underline that sits a touch below the text (underline-offset-4).
- All form fields, labels, placeholders, button copy, and pending states are unchanged.

Quick functional sanity:
- Click the cross-link on `/login` — should navigate to `/signup`. And vice versa.
- Visit http://localhost:3000/login?redirect=/portfolio — view-source the form; the hidden `<input name="redirect" value="/portfolio">` should still be present.

- [ ] **Step 2.7: Commit**

```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/signup/page.tsx
git commit -m "style(auth): tighten form rhythm and soften cross-link styling"
```

---

## Task 3: End-to-end verification

**Files:** none modified

This task confirms the combined changes hold up.

- [ ] **Step 3.1: Run typecheck on the whole project**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3.2: Run lint on the whole project**

```bash
npm run lint
```

Expected: no errors introduced by this branch. Pre-existing warnings unrelated to auth pages are fine.

- [ ] **Step 3.3: Build sanity check**

```bash
npm run build
```

Expected: build succeeds. The build is a stronger structural check than dev mode — catches things like server/client component boundary issues that hot-reload sometimes papers over. If the build complains about a Client Component using `next/link` inside an `aside` (it shouldn't — `next/link` works in both), inspect and fix.

- [ ] **Step 3.4: Manual visual check against the spec**

Open the spec at `docs/superpowers/specs/2026-05-22-auth-2col-design.md`, scroll to the "Verification" section, and walk through each item in a browser:

1. `npm run dev` and visit `/login` and `/signup` at viewport widths `lg` (≥1024px) and below.
2. Visual checks:
   - At `lg` and above: 2-column with form left, panel right.
   - Below `lg`: form only, no panel artifacts.
   - Form column header (`h-12`) and panel header bar align horizontally; same for the bottom edges with the panel footer.
   - Feature block reads as one rounded container with internal hairlines, not four floating cards.
   - No hover lift / shadow / blur on the panel.
   - Dark mode (toggle via the theme button): hairlines, chip backgrounds, and muted text remain readable.
3. Functional checks:
   - Submit invalid creds on `/login` → error renders below form.
   - Submit a valid signup payload (use a throwaway email) → `info` confirmation block renders.
   - Cross-links navigate between `/login` and `/signup`.
   - `?redirect=` query param round-trips through the login form's hidden input.

Note: if Supabase isn't configured locally, the server-action functional checks (submit invalid creds, valid signup) may fail at the network layer rather than render an error state. In that case skip the functional checks and rely on typecheck + build + visual.

- [ ] **Step 3.5: No commit needed**

Verification only. The two functional commits from Tasks 1 and 2 are the final state.

If any of the checks failed, return to Task 1 or 2 to fix; otherwise this plan is complete.
