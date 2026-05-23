"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { SymbolSearchHit } from "@/lib/market/types";

export function SidebarSearch() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    const myId = ++reqId.current;
    const ac = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!r.ok) throw new Error("search_failed");
        const { hits } = (await r.json()) as { hits: SymbolSearchHit[] };
        if (myId === reqId.current) setHits(hits.slice(0, 10));
      } catch {
        if (myId === reqId.current) {
          setError("Search unavailable, try again");
          setHits([]);
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

  function go(hit: SymbolSearchHit) {
    router.push(
      `/stocks/${encodeURIComponent(hit.symbol)}?exchange=${hit.exchange}` as Route,
    );
    setText("");
    setOpen(false);
  }

  const showPopover = open && text.trim().length > 0;

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search stocks…"
            className="h-8 pl-7 text-xs"
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        role="listbox"
      >
        {error ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{error}</p>
        ) : loading && hits.length === 0 ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : hits.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches</p>
        ) : (
          hits.map((h) => (
            <button
              key={`${h.exchange}:${h.symbol}`}
              type="button"
              role="option"
              aria-selected={false}
              aria-label={`${h.symbol} ${h.exchange}`}
              onClick={() => go(h)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-xs hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-medium">{h.symbol}</span>
                <span className="text-[10px] text-muted-foreground">
                  {h.exchange}
                </span>
              </span>
              {h.name ? (
                <span className="truncate text-[10px] text-muted-foreground">
                  {h.name}
                </span>
              ) : null}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
