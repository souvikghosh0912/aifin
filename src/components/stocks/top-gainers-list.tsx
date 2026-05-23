import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, MoreHorizontal, Plus, Table2 } from "lucide-react";

import { getTopGainers } from "@/lib/market/top-gainers";
import { cn, formatNumber } from "@/lib/utils";

interface Props {
  activeSymbol: string;
}

// Deterministic pastel-ish background colour for the symbol disc. We hash the
// symbol so the same ticker always gets the same colour across renders.
function tickerColor(symbol: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return {
    bg: `hsl(${hue} 65% 42%)`,
    fg: "white",
  };
}

function tickerInitial(symbol: string): string {
  return symbol.slice(0, 2);
}

function formatChange(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function formatChangePct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
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
      className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

export async function TopGainersList({ activeSymbol }: Props) {
  const rows = await getTopGainers();

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-2.5 py-1.5">
        <button
          type="button"
          className="flex items-center gap-1 text-[13px] font-semibold text-foreground"
        >
          Watchlist
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-0.5">
          <HeaderIcon label="Add symbol">
            <Plus className="h-3.5 w-3.5" />
          </HeaderIcon>
          <HeaderIcon label="Toggle columns">
            <Table2 className="h-3.5 w-3.5" />
          </HeaderIcon>
          <HeaderIcon label="More">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </HeaderIcon>
        </div>
      </header>

      <div
        className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2.5 border-b px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        aria-hidden
      >
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right">Chg</span>
        <span className="text-right">Chg%</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          className="flex w-full items-center gap-1 border-b px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          <ChevronDown className="h-3 w-3" />
          Stocks
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {rows.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              Couldn&apos;t load top gainers.
            </p>
          ) : (
            rows.map((r) => {
              const active = r.symbol === activeSymbol;
              const up = r.changePct >= 0;
              const colour = tickerColor(r.symbol);
              const href =
                `/stocks/${encodeURIComponent(r.symbol)}?exchange=NSE` as Route;
              return (
                <div key={r.symbol} className="px-1 py-px">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2.5 rounded px-1.5 py-1 text-[11px] transition-colors",
                      active
                        ? "bg-accent/50 ring-1 ring-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        style={{ background: colour.bg, color: colour.fg }}
                        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full font-mono text-[9px] font-bold uppercase leading-none"
                      >
                        {tickerInitial(r.symbol)}
                      </span>
                      <span className="truncate font-mono text-[11px] font-semibold uppercase text-foreground">
                        {r.symbol}
                      </span>
                      <span
                        aria-hidden
                        className="h-[3px] w-[3px] shrink-0 rounded-full bg-muted-foreground/60"
                      />
                    </span>
                    <span className="num text-right tabular-nums text-foreground">
                      {formatNumber(r.lastPrice)}
                    </span>
                    <span
                      className={cn(
                        "num text-right tabular-nums",
                        up ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatChange(r.change)}
                    </span>
                    <span
                      className={cn(
                        "num text-right tabular-nums",
                        up ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatChangePct(r.changePct)}
                    </span>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
