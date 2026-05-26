"use client";

import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SymbolSearchHit } from "@/lib/market/types";
import { cn } from "@/lib/utils";

import { InstrumentIcon, VenueFlag } from "./instrument-icon";
import { RECENT_INSTRUMENTS, type Instrument } from "./instrument-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Full instrument-picker modal matching instrumentmodal.png. Opens
 * from the "More instruments" affordance in the instrument popover
 * (and could in future be wired to /select symbol affordances
 * elsewhere). Searches /api/search live; when the query is empty,
 * renders the seeded recent-instruments list.
 */
export function InstrumentModal({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 200);

  // Reset the query when the modal is dismissed so reopening starts
  // fresh — the picker is supposed to feel ephemeral.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as
          | { hits?: SymbolSearchHit[] }
          | null;
        if (!cancelled) setHits(body?.hits ?? []);
      })
      .catch(() => {
        if (!cancelled) setHits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const showSearchResults = debounced.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:rounded-lg">
        <div className="flex items-center justify-between px-6 pb-4 pt-6">
          <DialogTitle className="text-xl font-bold">
            Select instruments
          </DialogTitle>
          {/* Built-in DialogContent close (X) sits absolute top-right. */}
        </div>
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, symbol, ISIN, or CUSIP"
              className="h-10 rounded-md pl-9 text-[13px]"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-2 pb-4">
          {showSearchResults ? (
            <SearchResults loading={loading} hits={hits} onPick={() => onOpenChange(false)} />
          ) : (
            <RecentList onPick={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecentList({ onPick }: { onPick: () => void }) {
  return (
    <>
      <p className="px-4 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recent instruments
      </p>
      <ul className="divide-y">
        {RECENT_INSTRUMENTS.map((it) => (
          <li key={`${it.venue}:${it.symbol}`}>
            <InstrumentRow instrument={it} onPick={onPick} />
          </li>
        ))}
      </ul>
    </>
  );
}

function SearchResults({
  loading,
  hits,
  onPick,
}: {
  loading: boolean;
  hits: SymbolSearchHit[];
  onPick: () => void;
}) {
  const mapped = useMemo(() => hits.map(hitToInstrument), [hits]);
  if (loading) {
    return (
      <div className="space-y-2 px-4 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (mapped.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No matches.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {mapped.map((it) => (
        <li key={`${it.venue}:${it.symbol}`}>
          <InstrumentRow instrument={it} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function InstrumentRow({
  instrument,
  onPick,
}: {
  instrument: Instrument;
  onPick: () => void;
}) {
  const href = buildHref(instrument);
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60">
      <InstrumentIcon instrument={instrument} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">
          {instrument.symbol}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">
          {instrument.name}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-[13px] font-medium text-foreground">
            {instrument.venue}
          </p>
          <p className="text-[11px] text-muted-foreground">{instrument.type}</p>
        </div>
        <VenueFlag instrument={instrument} />
      </div>
    </div>
  );
  if (!href) {
    return (
      <button
        type="button"
        className={cn(
          "block w-full text-left",
          "disabled:opacity-60",
        )}
        disabled
      >
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} onClick={onPick} className="block">
      {inner}
    </Link>
  );
}

function buildHref(it: Instrument): Route | null {
  if (!it.exchange) return null;
  return `/stocks/${encodeURIComponent(it.symbol)}/news-flow?exchange=${it.exchange}` as Route;
}

function hitToInstrument(h: SymbolSearchHit): Instrument {
  return {
    symbol: h.symbol,
    name: h.name ?? h.symbol,
    venue: h.exchange,
    type: "stock",
    iconBg: "bg-muted",
    iconFg: "text-foreground",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
    exchange: h.exchange,
  };
}
