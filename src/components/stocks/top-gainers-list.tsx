import Link from "next/link";
import type { Route } from "next";

import { getTopGainers } from "@/lib/market/top-gainers";
import { cn, formatPercent } from "@/lib/utils";

interface Props {
  activeSymbol: string;
}

export async function TopGainersList({ activeSymbol }: Props) {
  const rows = await getTopGainers();
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Top gainers · Nifty 50
      </div>
      <div className="max-h-64 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            Couldn&apos;t load top gainers.
          </p>
        ) : (
          rows.map((r) => {
            const active = r.symbol === activeSymbol;
            const href =
              `/stocks/${encodeURIComponent(r.symbol)}?exchange=NSE` as Route;
            return (
              <Link
                key={r.symbol}
                href={href}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1 text-xs",
                  active
                    ? "bg-accent/50 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="truncate font-medium">{r.symbol}</span>
                <span className="num text-success tabular-nums">
                  +{formatPercent(r.changePct)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
