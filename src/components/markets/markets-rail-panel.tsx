"use client";

import { ExternalLink, LayoutGrid, MoreHorizontal, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { SignalBadge } from "@/components/stocks/signal-badge";
import { RailExtras } from "@/components/markets/rail-extras";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketQuoteSnapshot } from "@/lib/market/markets";
import type { MarketEntry } from "@/lib/market/markets-catalog";
import { computeSignal } from "@/lib/market/signal";
import type { HistoricalCandle, Quote } from "@/lib/market/types";
import { cn, formatINR, formatNumber } from "@/lib/utils";

interface Props {
  entries: MarketEntry[];
  initialQuotes: MarketQuoteSnapshot[];
  selectedEntryId: string;
}

const ASOF_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
  hour12: false,
});

const COMPACT_FMT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return COMPACT_FMT.format(v);
}

function fmtPrice(v: number | null): string {
  return v == null ? "—" : formatINR(v);
}

function tickerColor(symbol: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return { bg: `hsl(${hue} 65% 42%)`, fg: "white" };
}

function HeaderIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-foreground/90">{label}</dt>
      <dd className="num text-right font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </>
  );
}

/**
 * Right-rail details panel for the /markets page. Lives below the watchlist
 * (TopGainersList) and reflects whichever indice/stock the user last clicked
 * in either MarketsSection carousel. Mirrors the layout of the stocks-page
 * KeyDetailsPanel but renders client-side because the selection is interactive.
 */
export function MarketsRailPanel({
  entries,
  initialQuotes,
  selectedEntryId,
}: Props) {
  const entry =
    entries.find((e) => e.id === selectedEntryId) ?? entries[0] ?? null;
  const baseQuote = entry
    ? (initialQuotes.find((q) => q.id === entry.id) ?? null)
    : null;

  const [candles, setCandles] = useState<HistoricalCandle[]>([]);
  const [stockQuote, setStockQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setStockQuote(null);
    setCandles([]);
    setLoading(true);

    const candlesPromise = fetch(
      `/api/markets/historical/${encodeURIComponent(entry.id)}?range=1M`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as
          | { candles?: HistoricalCandle[] }
          | null;
        return body?.candles ?? [];
      })
      .catch(() => [] as HistoricalCandle[]);

    const quotePromise =
      entry.kind === "stock"
        ? fetch(
            `/api/quote/${encodeURIComponent(entry.symbol)}?exchange=${entry.exchange}`,
            { cache: "no-store" },
          )
            .then(async (r) => {
              const body = await r.json().catch(() => null);
              if (!body || (body as { error?: string }).error) return null;
              return body as Quote;
            })
            .catch(() => null)
        : Promise.resolve<Quote | null>(null);

    Promise.all([candlesPromise, quotePromise]).then(
      ([newCandles, newQuote]) => {
        if (cancelled) return;
        setCandles(newCandles);
        setStockQuote(newQuote);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [entry?.id, entry?.kind, entry?.symbol, entry?.exchange]);

  if (!entry) return null;

  const last30 = candles.slice(-30);
  const avgVol30d =
    last30.length === 0
      ? null
      : last30.reduce((s, c) => s + (c.volume ?? 0), 0) / last30.length;
  const signal = computeSignal(candles.map((c) => c.close));

  const lastPrice = stockQuote?.lastPrice ?? baseQuote?.lastPrice ?? null;
  const change = stockQuote?.change ?? baseQuote?.change ?? null;
  const changePct = stockQuote?.changePct ?? baseQuote?.changePct ?? null;
  const dayHigh = stockQuote?.dayHigh ?? null;
  const dayLow = stockQuote?.dayLow ?? null;
  const volume = stockQuote?.volume ?? null;
  const asOfDate = stockQuote ? new Date(stockQuote.asOf) : null;
  const open =
    asOfDate != null &&
    Number.isFinite(asOfDate.getTime()) &&
    Date.now() - asOfDate.getTime() < 10 * 60_000;

  const up = (change ?? 0) >= 0;
  const colour = tickerColor(entry.shortName);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-card">
      <header className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span
          aria-hidden
          style={{ background: colour.bg, color: colour.fg }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold uppercase leading-none"
        >
          {entry.shortName.slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold uppercase tracking-tight">
          {entry.shortName}
        </span>
        <div className="flex items-center gap-0.5">
          <HeaderIcon label="Compare">
            <LayoutGrid className="h-3.5 w-3.5" />
          </HeaderIcon>
          <HeaderIcon label="Notes">
            <Pencil className="h-3.5 w-3.5" />
          </HeaderIcon>
          <HeaderIcon label="More">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </HeaderIcon>
        </div>
      </header>

      <div className="space-y-0.5 px-3">
        <p className="flex items-center gap-1.5 text-[13px] font-medium leading-tight">
          <span className="truncate">{entry.name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">·</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {entry.kind === "stock" ? entry.exchange : "Index"}
          </span>
        </p>
      </div>

      <div className="px-3 pb-1 pt-3">
        {lastPrice == null ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="num text-3xl font-semibold leading-none tabular-nums">
                {entry.kind === "stock"
                  ? formatINR(lastPrice).replace(/^₹\s*/, "")
                  : formatNumber(lastPrice)}
              </span>
              {entry.kind === "stock" ? (
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  INR
                </span>
              ) : null}
            </div>
            <div
              className={cn(
                "num mt-1 text-[13px] font-semibold tabular-nums",
                up ? "text-success" : "text-destructive",
              )}
            >
              {up ? "+" : ""}
              {(change ?? 0).toFixed(2)}{" "}
              <span className="ml-0.5">
                {up ? "+" : ""}
                {(changePct ?? 0).toFixed(2)}%
              </span>
            </div>
          </>
        )}
      </div>

      {entry.kind === "stock" ? (
        <div className="px-3 pb-3 pt-2 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "inline-block h-1 w-2.5 rounded-sm",
                open ? "bg-success" : "bg-muted-foreground/60",
              )}
            />
            {open ? "Market open" : "Market closed"}
          </p>
          {asOfDate && Number.isFinite(asOfDate.getTime()) ? (
            <p className="mt-0.5 leading-snug">
              Last update at {ASOF_FMT.format(asOfDate)}
              <br />
              GMT+5:30
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="border-t px-3 py-3">
        <h3 className="text-[13px] font-semibold">Key stats</h3>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1.5 text-[11px]">
          {entry.kind === "stock" ? (
            <>
              <Row label="Volume" value={formatCompact(volume)} />
              <Row
                label="Average Volume (30D)"
                value={formatCompact(avgVol30d)}
              />
              <Row label="Day high" value={fmtPrice(dayHigh)} />
              <Row label="Day low" value={fmtPrice(dayLow)} />
            </>
          ) : (
            <Row
              label="Average Volume (30D)"
              value={formatCompact(avgVol30d)}
            />
          )}
          <Row
            label="Signal"
            value={
              loading ? (
                <Skeleton className="h-3 w-10" />
              ) : (
                <SignalBadge value={signal} />
              )
            }
          />
        </dl>
      </div>

      {entry.kind === "stock" ? (
        <RailExtras
          key={entry.id}
          kind="stock"
          symbol={entry.symbol}
          exchange={entry.exchange}
        />
      ) : (
        <RailExtras key={entry.id} kind="index" marketId={entry.id} />
      )}
    </section>
  );
}
