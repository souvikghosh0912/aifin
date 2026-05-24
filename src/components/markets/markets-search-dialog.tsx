"use client";

import type { Route } from "next";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_MARKETS,
  INDICES,
  STOCKS,
  type MarketEntry,
} from "@/lib/market/markets-catalog";
import type { SymbolSearchHit } from "@/lib/market/types";
import { cn } from "@/lib/utils";

type Tab = "all" | "stocks" | "futures" | "funds";
type Category = "all" | "stock" | "index";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks" },
  { id: "futures", label: "Futures" },
  { id: "funds", label: "Funds" },
];

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "all", label: "All categories" },
  { id: "stock", label: "Single stock" },
  { id: "index", label: "Indices" },
];

/** Display row — unified shape for both catalog entries and live search hits. */
interface DisplayRow {
  key: string;
  symbol: string;
  name: string;
  kind: "stock" | "index";
  exchange: string;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function catalogToRow(e: MarketEntry): DisplayRow {
  return {
    key: `${e.kind}:${e.symbol}`,
    symbol: e.shortName,
    name: e.name,
    kind: e.kind,
    exchange: e.exchange,
  };
}

function hitToRow(h: SymbolSearchHit): DisplayRow {
  return {
    key: `${h.exchange}:${h.symbol}`,
    symbol: h.symbol,
    name: h.name ?? h.symbol,
    kind: "stock",
    exchange: h.exchange,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketsSearchDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 200);
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!debounced) {
      setHits([]);
      setError(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as
          | { hits?: SymbolSearchHit[]; error?: string }
          | null;
        if (cancelled) return;
        if (!r.ok || body?.error) {
          setHits([]);
          setError("Search is temporarily unavailable.");
          return;
        }
        setHits(body?.hits ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setHits([]);
        setError("Search is temporarily unavailable.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const rows: DisplayRow[] = useMemo(() => {
    if (tab === "futures" || tab === "funds") return [];

    const wantKind: "stock" | "index" | "all" =
      tab === "stocks" ? "stock" : category;

    if (!debounced) {
      let source: MarketEntry[];
      if (wantKind === "stock") source = STOCKS;
      else if (wantKind === "index") source = INDICES;
      else source = ALL_MARKETS;
      return source.map(catalogToRow);
    }

    const needle = debounced.toUpperCase();
    const catalogMatches = ALL_MARKETS.filter(
      (e) =>
        e.shortName.toUpperCase().includes(needle) ||
        e.name.toUpperCase().includes(needle),
    ).map(catalogToRow);
    const searchRows = hits.map(hitToRow);

    const merged = new Map<string, DisplayRow>();
    for (const r of catalogMatches) merged.set(r.key, r);
    for (const r of searchRows) {
      if (!merged.has(r.key)) merged.set(r.key, r);
    }
    const all = [...merged.values()];
    if (wantKind === "all") return all;
    return all.filter((r) => r.kind === wantKind);
  }, [tab, category, debounced, hits]);

  const showEmpty = !searching && rows.length === 0;
  const emptyMessage =
    tab === "futures" || tab === "funds"
      ? `No ${tab} listed yet.`
      : debounced
        ? `No matches for "${debounced}".`
        : "No symbols to show.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid h-[min(640px,90vh)] w-[min(720px,95vw)] max-w-none grid-rows-[auto_auto_1fr_auto] gap-0 overflow-hidden p-0 sm:rounded-xl [&>button.absolute]:hidden"
      >
        {/* Header: title + search input + close */}
        <div className="border-b">
          <div className="flex items-center justify-between px-4 pt-4">
            <DialogTitle className="text-sm font-semibold">
              Add symbol
            </DialogTitle>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 pb-3 pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Symbol, name, or ISIN"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Tabs + Categories */}
        <div className="border-b">
          <div className="flex items-center gap-1 px-2 pt-1">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-3 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {CATEGORIES.find((c) => c.id === category)?.label ??
                    "Categories"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {CATEGORIES.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => setCategory(c.id)}
                    className={cn(
                      c.id === category && "bg-accent text-accent-foreground",
                    )}
                  >
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Result list */}
        <div className="overflow-y-auto">
          {searching ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : showEmpty ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <ResultRow
                  key={r.key}
                  row={r}
                  onClose={() => onOpenChange(false)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer keyboard hint (visual parity) */}
        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Kbd>Shift</Kbd>+<Kbd>Click</Kbd>
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>Enter</Kbd>
            </span>
            <span>Add symbol and close dialog</span>
          </div>
          <span className="font-mono">↵</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({
  row,
  onClose,
}: {
  row: DisplayRow;
  onClose: () => void;
}) {
  return (
    <li className="group relative">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="w-24 shrink-0 font-mono text-[13px] font-semibold text-foreground">
          {row.symbol}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {row.name}
        </span>
        {/* Always-visible badges (hidden when row is hovered to make room for actions). */}
        <div className="flex shrink-0 items-center gap-2 transition-opacity group-hover:opacity-0">
          <Badge variant="outline" className="text-[10px] uppercase">
            {row.kind}
          </Badge>
          {row.kind === "stock" ? (
            <Badge variant="outline" className="text-[10px]">
              {row.exchange}
            </Badge>
          ) : null}
        </div>
      </div>
      {/* Hover actions: absolutely positioned on the right edge. */}
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          onClick={() => toast.info("Launch chart — coming soon")}
          className="rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm hover:bg-accent"
        >
          Launch chart
        </button>
        {row.kind === "stock" ? (
          <Link
            href={
              `/stocks/${encodeURIComponent(row.symbol)}?exchange=${row.exchange}` as Route
            }
            onClick={onClose}
            className="rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm hover:bg-accent"
          >
            See overview
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-card px-1 py-px font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}
