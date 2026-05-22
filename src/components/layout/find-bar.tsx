"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Input } from "@/components/ui/input";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import type { Exchange } from "@/types/database";
import { cn } from "@/lib/utils";

type SymbolRow = { symbol: string; exchange: Exchange };

interface PortfolioIndex {
  holdings: SymbolRow[];
  watchlist: SymbolRow[];
}

type Hit =
  | { kind: "nav"; item: NavItem }
  | { kind: "holding"; row: SymbolRow }
  | { kind: "watchlist"; row: SymbolRow };

async function fetchPortfolioIndex(): Promise<PortfolioIndex> {
  const res = await fetch("/api/portfolio/index", { cache: "no-store" });
  if (!res.ok) throw new Error("portfolio_index_failed");
  return (await res.json()) as PortfolioIndex;
}

function matchNav(q: string): NavItem[] {
  if (!q) return [...NAV_ITEMS];
  const needle = q.toLowerCase();
  return NAV_ITEMS.filter(
    (i) =>
      i.label.toLowerCase().includes(needle) ||
      i.href.toLowerCase().includes(needle),
  );
}

function matchSymbols(q: string, list: SymbolRow[], limit: number): SymbolRow[] {
  if (!q) return list.slice(0, limit);
  const needle = q.toUpperCase();
  return list.filter((r) => r.symbol.includes(needle)).slice(0, limit);
}

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable;
}

export function FindBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  // Keep the panel + backdrop mounted briefly after `open` flips to false
  // so the exit animation has time to play. Must match the duration classes.
  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(t);
  }, [open, visible]);

  const { data } = useQuery({
    queryKey: ["portfolio-index"],
    queryFn: fetchPortfolioIndex,
    enabled: open,
    staleTime: 60_000,
  });

  const hits = useMemo<Hit[]>(() => {
    const nav = matchNav(query).map<Hit>((item) => ({ kind: "nav", item }));
    const holdings = matchSymbols(query, data?.holdings ?? [], query ? 8 : 5);
    const watchlist = matchSymbols(query, data?.watchlist ?? [], query ? 8 : 5);
    return [
      ...nav,
      ...holdings.map<Hit>((row) => ({ kind: "holding", row })),
      ...watchlist.map<Hit>((row) => ({ kind: "watchlist", row })),
    ];
  }, [query, data]);

  useEffect(() => {
    setCursor(0);
  }, [query, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }, []);

  const activate = useCallback(
    (hit: Hit) => {
      const href: Route =
        hit.kind === "nav"
          ? hit.item.href
          : hit.kind === "holding"
            ? ("/holdings" as Route)
            : ("/watchlist" as Route);
      router.push(href);
      close();
    },
    [router, close],
  );

  // Global shortcuts: F (when not typing), Cmd/Ctrl+K (always), Escape (when open).
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
        return;
      }
      const cmdK =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "k";
      if (cmdK) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      const bareF =
        e.key === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !isEditableTarget(document.activeElement);
      if (bareF) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Outside-click closes.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (hits.length === 0 ? 0 : (c + 1) % hits.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) =>
        hits.length === 0 ? 0 : (c - 1 + hits.length) % hits.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[cursor];
      if (hit) activate(hit);
    }
  }

  // Build sectioned render with the flat-cursor index baked in.
  const navHits = hits.filter((h) => h.kind === "nav");
  const holdingHits = hits.filter((h) => h.kind === "holding");
  const watchlistHits = hits.filter((h) => h.kind === "watchlist");

  let flatIndex = -1;
  const renderRow = (hit: Hit) => {
    flatIndex += 1;
    const active = flatIndex === cursor;
    const key =
      hit.kind === "nav"
        ? `nav:${hit.item.href}`
        : `${hit.kind}:${hit.row.exchange}:${hit.row.symbol}`;
    const Icon = hit.kind === "nav" ? hit.item.icon : Search;
    const label =
      hit.kind === "nav" ? hit.item.label : hit.row.symbol;
    const trailing =
      hit.kind === "nav"
        ? hit.item.badge
        : hit.row.exchange;
    return (
      <button
        key={key}
        type="button"
        onClick={() => activate(hit)}
        onMouseEnter={() => setCursor(flatIndex)}
        className={cn(
          "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
          active && "bg-accent text-accent-foreground",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </span>
        {trailing ? (
          <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {trailing}
          </span>
        ) : null}
      </button>
    );
  };

  const state = open ? "open" : "closed";

  return (
    <>
      {visible ? (
        <div
          aria-hidden
          data-state={state}
          className="fixed inset-0 z-40 bg-black/40 duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
      ) : null}
      <div
        ref={containerRef}
        className={cn("relative px-2 pt-2", visible && "z-50")}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onInputKeyDown}
            placeholder="Find…"
            aria-label="Find across the app and your portfolio"
            autoComplete="off"
            spellCheck={false}
            className="h-8 pl-7 pr-12 text-xs"
          />
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-block">
            {typeof navigator !== "undefined" &&
            navigator.platform.toLowerCase().includes("mac")
              ? "⌘K"
              : "Ctrl K"}
          </kbd>
        </div>

        {visible ? (
          <div
            data-state={state}
            className="absolute left-2 top-full z-50 mt-1 w-[22rem] max-h-[28rem] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1"
          >
            {hits.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No matches.
              </p>
            ) : (
              <>
                {navHits.length > 0 ? (
                  <div className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Go to
                    </p>
                    {navHits.map(renderRow)}
                  </div>
                ) : null}
                {holdingHits.length > 0 ? (
                  <div className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Holdings
                    </p>
                    {holdingHits.map(renderRow)}
                  </div>
                ) : null}
                {watchlistHits.length > 0 ? (
                  <div className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Watchlist
                    </p>
                    {watchlistHits.map(renderRow)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
