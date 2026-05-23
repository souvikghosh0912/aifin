import { SignalBadge } from "@/components/stocks/signal-badge";
import { getHistorical } from "@/lib/market/historical";
import { computeSignal } from "@/lib/market/signal";
import type { Exchange } from "@/types/database";
import type { MetaInfo, Quote } from "@/lib/market/types";
import { formatINR, formatNumber } from "@/lib/utils";

interface Props {
  symbol: string;
  exchange: Exchange;
  quote: Quote;
  meta: MetaInfo;
}

export async function KeyDetailsPanel({ symbol, exchange, quote, meta }: Props) {
  const candles = await getHistorical(symbol, exchange, "1M");
  const last30 = candles.slice(-30);
  const avgVol30d =
    last30.length === 0
      ? null
      : last30.reduce((sum, c) => sum + (c.volume ?? 0), 0) / last30.length;
  const signal = computeSignal(candles.map((c) => c.close));

  const name = meta.name ?? quote.name ?? "—";

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Key details
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-xs">
        <Row
          label="Name"
          value={
            <span className="truncate" title={name}>
              {name}
            </span>
          }
        />
        <Row
          label="Price"
          value={
            <span className="num tabular-nums">{formatINR(quote.lastPrice)}</span>
          }
        />
        <Row
          label="Avg vol (30d)"
          value={
            <span className="num tabular-nums">
              {avgVol30d == null ? "—" : formatNumber(Math.round(avgVol30d))}
            </span>
          }
        />
        <Row
          label="Mkt cap"
          value={
            <span className="num tabular-nums">
              {meta.marketCap == null
                ? "—"
                : formatINR(meta.marketCap, { compact: true })}
            </span>
          }
        />
        <Row label="Signal" value={<SignalBadge value={signal} />} />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}
