"use client";

import { Zap } from "lucide-react";

import type { NewsItem } from "@/lib/market/news";
import { cn } from "@/lib/utils";

interface Props {
  items: NewsItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  /** When true, every row renders a Flash badge next to the headline. */
  flash?: boolean;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/**
 * Left column of the News Flow page — scrollable list of headlines for the
 * current category. Each row shows a short date, the publisher name, and
 * the headline (truncated to two lines). Clicking a row swaps the selected
 * article rendered by <NewsFlowReader>.
 *
 * Matches the layout in newsflow.png: dense rows, no card chrome, an
 * active selection indicator on the left edge.
 */
export function NewsFlowList({ items, selectedId, onSelect, loading, flash = false }: Props) {
  if (loading) {
    return <ListSkeleton />;
  }
  if (items.length === 0) {
    return (
      <div className="min-h-0 overflow-y-auto border-r pr-3 text-sm text-muted-foreground">
        <p className="px-2 py-6">No headlines for this filter.</p>
      </div>
    );
  }
  return (
    <ul className="min-h-0 divide-y overflow-y-auto border-r pr-1">
      {items.map((item) => {
        const active = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              className={cn(
                "relative grid w-full grid-cols-[68px_1fr] gap-x-3 px-3 py-2.5 text-left transition-colors",
                active ? "bg-accent" : "hover:bg-accent/40",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-foreground"
                />
              ) : null}
              <span className="pt-[2px] text-[11px] uppercase tracking-wide text-muted-foreground">
                {DATE_FMT.format(new Date(item.publishedAt))}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] font-medium text-foreground">
                  {flash ? (
                    <span className="mr-1 inline-flex h-[16px] -translate-y-px items-center gap-0.5 rounded-sm bg-amber-100 px-1 align-middle text-[9px] font-bold uppercase tracking-wider text-amber-700">
                      <Zap className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                      <span>Flash</span>
                    </span>
                  ) : null}
                  {item.title}
                </span>
                {item.publisher ? (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {item.publisher}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <ul className="min-h-0 divide-y overflow-y-auto border-r pr-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <li key={i} className="px-3 py-3">
          <div className="grid grid-cols-[68px_1fr] gap-x-3">
            <span className="h-3 w-12 animate-pulse rounded bg-muted" />
            <div className="space-y-1.5">
              <span className="block h-3 w-full animate-pulse rounded bg-muted" />
              <span className="block h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
