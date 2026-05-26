"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, ChevronRight, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SymbolSearchHit } from "@/lib/market/types";
import { cn } from "@/lib/utils";

import { InstrumentIcon } from "./instrument-icon";
import { InstrumentModal } from "./instrument-modal";
import { RECENT_INSTRUMENTS, type Instrument } from "./instrument-data";

interface Props {
  /** Symbol currently in the news flow URL — used to render the chip. */
  activeSymbol: string;
  /** Click handler for the chip's X button. Defaults to a no-op. */
  onClear?: () => void;
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
 * Chip + popover combo that lives next to the "Watchlists" label in
 * the news-flow filter bar. The chip shows the active instrument; the
 * popover offers a quick search + recent list, with a "More
 * instruments" footer button that escalates to the full modal.
 */
export function InstrumentPopover({ activeSymbol, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 200);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
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

  const handleOpenModal = () => {
    setOpen(false);
    setModalOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-accent px-1.5 text-[12px] font-medium text-foreground hover:bg-accent/80"
            aria-label="Change instrument"
          >
            <span className="text-foreground/60">+</span>
            <span className="font-mono uppercase">{activeSymbol}</span>
            <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            {onClear ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                aria-label="Clear instrument"
                className="ml-0.5 grid h-4 w-4 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[320px] p-0"
        >
          <div className="flex items-center justify-between px-3 pb-2 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Instruments
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              <span>Reset</span>
            </button>
          </div>
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbols"
                className="h-8 rounded-sm pl-8 text-[13px]"
              />
            </div>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {debounced.trim().length > 0 ? (
              <SearchList
                loading={loading}
                hits={hits}
                onPick={() => setOpen(false)}
              />
            ) : (
              <RecentList onPick={() => setOpen(false)} />
            )}
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex w-full items-center justify-between border-t px-3 py-2.5 text-[12px] font-medium text-foreground hover:bg-accent"
          >
            <span>More instruments</span>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </PopoverContent>
      </Popover>
      <InstrumentModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

function RecentList({ onPick }: { onPick: () => void }) {
  return (
    <ul className="divide-y">
      {RECENT_INSTRUMENTS.slice(0, 8).map((it) => (
        <li key={`${it.venue}:${it.symbol}`}>
          <InstrumentRowSmall instrument={it} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function SearchList({
  loading,
  hits,
  onPick,
}: {
  loading: boolean;
  hits: SymbolSearchHit[];
  onPick: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5 px-3 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (hits.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
        No matches.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {hits.map((h) => (
        <li key={`${h.exchange}:${h.symbol}`}>
          <InstrumentRowSmall instrument={hitToInstrument(h)} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function InstrumentRowSmall({
  instrument,
  onPick,
}: {
  instrument: Instrument;
  onPick: () => void;
}) {
  const href = buildHref(instrument);
  const inner = (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/60">
      <InstrumentIcon instrument={instrument} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground">
          {instrument.symbol}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {instrument.name}
        </p>
      </div>
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {instrument.venue}
      </span>
    </div>
  );
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={cn("block w-full text-left", "disabled:opacity-60")}
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
