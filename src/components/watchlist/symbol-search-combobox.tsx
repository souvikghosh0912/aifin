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
    const ac = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const sr = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
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
          signal: ac.signal,
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
    return () => {
      clearTimeout(handle);
      ac.abort();
    };
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

  const showList = open && (loading || hits.length > 0 || error !== null || text.trim().length > 0);

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
          aria-label={`${hit.symbol} ${hit.exchange}`}
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
