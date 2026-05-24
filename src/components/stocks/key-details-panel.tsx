import {
  ExternalLink,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
} from "lucide-react";

import { SignalBadge } from "@/components/stocks/signal-badge";
import { RailExtras } from "@/components/markets/rail-extras";
import { getFundamentals } from "@/lib/market/fundamentals";
import { getHistorical } from "@/lib/market/historical";
import { computeSignal } from "@/lib/market/signal";
import type { Exchange } from "@/types/database";
import type { MetaInfo, Quote } from "@/lib/market/types";
import { cn, formatINR } from "@/lib/utils";

interface Props {
  symbol: string;
  exchange: Exchange;
  quote: Quote;
  meta: MetaInfo;
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

export async function KeyDetailsPanel({ symbol, exchange, quote, meta }: Props) {
  const [candles, fundamentals] = await Promise.all([
    getHistorical(symbol, exchange, "1M"),
    getFundamentals(symbol, exchange),
  ]);
  const last30 = candles.slice(-30);
  const avgVol30d =
    last30.length === 0
      ? null
      : last30.reduce((sum, c) => sum + (c.volume ?? 0), 0) / last30.length;
  const signal = computeSignal(candles.map((c) => c.close));
  const up = quote.change >= 0;

  const name = meta.name ?? quote.name ?? quote.symbol;
  const colour = tickerColor(quote.symbol);
  const asOfDate = new Date(quote.asOf);
  const asOfText = Number.isFinite(asOfDate.getTime())
    ? ASOF_FMT.format(asOfDate)
    : null;
  // Loose heuristic: if the upstream tick is fresher than 10 min, market is
  // likely open. Yahoo's `regularMarketTime` updates during trading hours.
  const open =
    Number.isFinite(asOfDate.getTime()) &&
    Date.now() - asOfDate.getTime() < 10 * 60_000;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-lg border bg-card">
      <header className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span
          aria-hidden
          style={{ background: colour.bg, color: colour.fg }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold uppercase leading-none"
        >
          {quote.symbol.slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold uppercase tracking-tight">
          {quote.symbol}
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
          <span className="truncate">{name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">·</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {quote.exchange}
          </span>
        </p>
        {meta.industry ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {meta.industry}
          </p>
        ) : null}
      </div>

      <div className="px-3 pb-1 pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-3xl font-semibold leading-none tabular-nums">
            {formatINR(quote.lastPrice).replace(/^₹\s*/, "")}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            INR
          </span>
        </div>
        <div
          className={cn(
            "num mt-1 text-[13px] font-semibold tabular-nums",
            up ? "text-success" : "text-destructive",
          )}
        >
          {up ? "+" : ""}
          {quote.change.toFixed(2)}{" "}
          <span className="ml-0.5">
            {up ? "+" : ""}
            {quote.changePct.toFixed(2)}%
          </span>
        </div>
      </div>

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
        {asOfText ? (
          <p className="mt-0.5 leading-snug">
            Last update at {asOfText}
            <br />
            GMT+5:30
          </p>
        ) : null}
      </div>

      <div className="border-t px-3 py-3">
        <h3 className="text-[13px] font-semibold">Key stats</h3>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1.5 text-[11px]">
          <Row label="Volume" value={formatCompact(quote.volume)} />
          <Row label="Average Volume (30D)" value={formatCompact(avgVol30d)} />
          <Row
            label="Market capitalization"
            value={formatCompact(
              fundamentals.marketCap ?? meta.marketCap,
            )}
          />
          <Row label="Day high" value={fmtPrice(quote.dayHigh)} />
          <Row label="Day low" value={fmtPrice(quote.dayLow)} />
          <Row
            label="Last earnings report"
            value={formatRelativeReportDate(
              fundamentals.earnings?.reportDate ?? null,
            )}
          />
          <Row label="Signal" value={<SignalBadge value={signal} />} />
        </dl>
      </div>

      <RailExtras kind="stock" symbol={symbol} exchange={exchange} />
    </section>
  );
}

const REPORT_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

function formatRelativeReportDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60_000));
  if (days < 0) return `in ${-days} days`;
  if (days === 0) return "today";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return REPORT_DATE_FMT.format(d);
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

function fmtPrice(v: number | null): string {
  return v == null ? "—" : formatINR(v);
}
