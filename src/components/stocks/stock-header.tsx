import { ExchangeSelect } from "@/components/stocks/exchange-select";
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

function ticker(name: string): string {
  // First initial for the avatar disc — matches the small brand mark on
  // TradingView's stock pages without needing an actual logo lookup.
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
}

export function StockHeader({ quote, meta }: Props) {
  const name = meta.name ?? quote.name ?? quote.symbol;
  const up = quote.change >= 0;
  const priceStr = formatINR(quote.lastPrice).replace(/^₹\s*/, "");
  const asOfDate = new Date(quote.asOf);
  const asOfText = Number.isFinite(asOfDate.getTime())
    ? `as of ${TIME_FMT.format(asOfDate)} IST`
    : null;

  return (
    <header className="border-b pb-5">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-bold tracking-tight text-foreground"
        >
          {ticker(name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-tight tracking-tight md:text-2xl">
            {name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
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
            </div>
            {meta.industry ? (
              <>
                <span className="opacity-30">·</span>
                <span className="truncate">{meta.industry}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-4xl font-semibold leading-none tracking-tight tabular-nums md:text-[44px]">
            {priceStr}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            INR
          </span>
        </div>
        <div
          className={cn(
            "num flex items-baseline gap-1 text-sm font-semibold tabular-nums",
            up ? "text-success" : "text-destructive",
          )}
        >
          <span>{signed(quote.change)}</span>
          <span>({signed(quote.changePct)}%)</span>
        </div>
      </div>

      {asOfText ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{asOfText}</p>
      ) : null}
    </header>
  );
}
