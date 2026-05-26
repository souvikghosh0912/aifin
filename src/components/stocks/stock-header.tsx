import {
  Bell,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
} from "lucide-react";

import { ExchangeSelect } from "@/components/stocks/exchange-select";
import { MarketStatus } from "@/components/stocks/market-status";
import type { MetaInfo, Quote } from "@/lib/market/types";
import { cn, formatINR, signed } from "@/lib/utils";

interface Props {
  quote: Quote;
  meta: MetaInfo;
}

const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
  hour12: false,
});

function tickerInitial(name: string): string {
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
}

// Hash a symbol to a stable HSL hue so each ticker keeps the same colour
// across renders — visually consistent with the watchlist disc.
function tickerColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 65% 38%)`;
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
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

export function StockHeader({ quote, meta }: Props) {
  const name = meta.name ?? quote.name ?? quote.symbol;
  const up = quote.change >= 0;
  const priceStr = formatINR(quote.lastPrice).replace(/^₹\s*/, "");
  const asOfDate = new Date(quote.asOf);
  const open =
    Number.isFinite(asOfDate.getTime()) &&
    Date.now() - asOfDate.getTime() < 10 * 60_000;
  const asOfText = Number.isFinite(asOfDate.getTime())
    ? `${open ? "Market open" : "close"} at ${TIME_FMT.format(asOfDate)} GMT+5:30`
    : null;

  return (
    <header className="pb-3">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          style={{ background: tickerColor(quote.symbol) }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-mono text-xl font-bold leading-none text-white"
        >
          {tickerInitial(name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-tight tracking-tight md:text-[28px]">
            {name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            <span className="font-mono text-[12px] font-semibold uppercase tracking-wide text-foreground">
              {quote.symbol}
            </span>
            <span className="opacity-30">·</span>
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  up ? "bg-success" : "bg-destructive",
                )}
              />
              <ExchangeSelect symbol={quote.symbol} current={quote.exchange} />
              <MarketStatus exchange={quote.exchange} />
            </div>
            {meta.industry ? (
              <>
                <span className="opacity-30">·</span>
                <span className="truncate">{meta.industry}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="hidden items-center gap-0.5 sm:flex">
          <HeaderIcon label="Add to watchlist">
            <Plus className="h-4 w-4" />
          </HeaderIcon>
          <HeaderIcon label="Compare">
            <LayoutGrid className="h-4 w-4" />
          </HeaderIcon>
          <HeaderIcon label="Notes">
            <Pencil className="h-4 w-4" />
          </HeaderIcon>
          <HeaderIcon label="Alert">
            <Bell className="h-4 w-4" />
          </HeaderIcon>
          <HeaderIcon label="Share">
            <Share2 className="h-4 w-4" />
          </HeaderIcon>
          <HeaderIcon label="More">
            <MoreHorizontal className="h-4 w-4" />
          </HeaderIcon>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-[40px] font-bold leading-none tracking-tight tabular-nums md:text-[44px]">
            {priceStr}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            INR
          </span>
        </div>
        <div
          className={cn(
            "num flex items-baseline gap-1 text-[15px] font-semibold tabular-nums",
            up ? "text-success" : "text-destructive",
          )}
        >
          <span>{signed(quote.change)}</span>
          <span>{signed(quote.changePct)}%</span>
        </div>
      </div>

      {asOfText ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "inline-block h-1 w-2 rounded-sm",
              open ? "bg-success" : "bg-muted-foreground/60",
            )}
          />
          {asOfText}
        </p>
      ) : null}
    </header>
  );
}
