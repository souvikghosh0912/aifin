import { ExchangeSelect } from "@/components/stocks/exchange-select";
import type { MetaInfo, Quote } from "@/lib/market/types";
import { cn, formatINR, signed } from "@/lib/utils";

interface Props {
  quote: Quote;
  meta: MetaInfo;
}

export function StockHeader({ quote, meta }: Props) {
  const name = meta.name ?? quote.name ?? quote.symbol;
  const up = quote.change >= 0;
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-[26px]">
        {name}
      </h1>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{quote.symbol}</span>
        <span className="opacity-50">·</span>
        <ExchangeSelect symbol={quote.symbol} current={quote.exchange} />
      </div>
      <div className="flex items-baseline gap-2 pt-1">
        <span className="num text-2xl font-semibold tabular-nums">
          {formatINR(quote.lastPrice)}
        </span>
        <span
          className={cn(
            "num text-xs tabular-nums",
            up ? "text-success" : "text-destructive",
          )}
        >
          <span>{signed(quote.change)}</span>{" "}
          <span>({signed(quote.changePct)}%)</span>
        </span>
      </div>
    </header>
  );
}
