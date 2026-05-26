"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRef, useState, useTransition } from "react";

import { fetchNewsByCategory } from "./news-actions";
import type { CategoryId, NewsItem } from "@/lib/market/news";
import type { Exchange } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  exchange: Exchange;
  name: string | null;
  initialItems: NewsItem[];
}

interface FilterDef {
  id: CategoryId | "more";
  label: string;
  trailing?: boolean;
}

const FILTERS: FilterDef[] = [
  { id: "all", label: "All" },
  { id: "key-facts", label: "Key facts" },
  { id: "earnings", label: "Earnings" },
  { id: "earnings-calls", label: "Earnings calls" },
  { id: "dividends", label: "Dividends" },
  { id: "strategy", label: "Strategy, business, and management" },
  { id: "mergers", label: "Mergers and acquisitions" },
  { id: "management", label: "Management" },
  { id: "esg", label: "ESG and regulation" },
  { id: "analysts", label: "Analysts" },
  { id: "more", label: "More in News Flow", trailing: true },
];

// Shared grid template keeps the column header row aligned with the data
// rows: time | instrument badge | headline | provider | favicon.
const ROW_GRID =
  "grid grid-cols-[110px_88px_1fr_180px_28px] items-center gap-x-4";

export function NewsPanel({ symbol, exchange, name, initialItems }: Props) {
  const [category, setCategory] = useState<CategoryId>("all");
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [pending, startTransition] = useTransition();
  // Ignore stale responses if the user clicks through categories quickly.
  const latestRef = useRef<CategoryId>("all");

  const newsFlowHref =
    `/stocks/${encodeURIComponent(symbol)}/news-flow` +
    `?exchange=${exchange}&category=${category}` as Route;

  const onSelect = (id: CategoryId | "more") => {
    if (id === "more") return; // visual-only "see more" pill — wraps a Link below
    if (id === category) return;
    setCategory(id);
    latestRef.current = id;
    startTransition(async () => {
      try {
        const next = await fetchNewsByCategory({
          symbol,
          exchange,
          name,
          category: id,
        });
        if (latestRef.current === id) setItems(next);
      } catch {
        if (latestRef.current === id) setItems([]);
      }
    });
  };

  const now = Date.now();

  return (
    <section id="news" className="space-y-4 pt-2">
      <h2 className="flex items-center gap-0.5 text-2xl font-extrabold tracking-tight text-foreground">
        <span>Latest headlines</span>
        <ChevronRight
          className="h-6 w-6 -translate-y-px text-foreground"
          strokeWidth={2.5}
          aria-hidden
        />
      </h2>

      <FilterRow
        active={category}
        onSelect={onSelect}
        disabled={pending}
        newsFlowHref={newsFlowHref}
      />

      {pending ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <p className="px-1 py-6 text-sm text-muted-foreground">
          No recent {category === "all" ? "headlines" : `${labelFor(category).toLowerCase()} headlines`} for {symbol}.
        </p>
      ) : (
        <div>
          <div
            className={cn(
              ROW_GRID,
              "border-b px-1 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
            )}
            aria-hidden
          >
            <span>Time</span>
            <span>Instrument</span>
            <span />
            <span>Provider</span>
            <span />
          </div>
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b last:border-b-0">
                <NewsRow item={item} now={now} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link
          href={newsFlowHref}
          className="inline-flex items-center gap-1 rounded-full bg-card px-4 py-2 text-[13px] font-semibold text-foreground ring-1 ring-border transition-colors hover:bg-accent"
        >
          <span>More in News Flow</span>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function FilterRow({
  active,
  onSelect,
  disabled,
  newsFlowHref,
}: {
  active: CategoryId;
  onSelect: (id: CategoryId | "more") => void;
  disabled: boolean;
  newsFlowHref: Route;
}) {
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1">
      {FILTERS.map((f) => {
        const isActive = f.id === active;
        const trailing = !!f.trailing;
        const className = cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
          isActive && "bg-foreground text-background",
          trailing &&
            !isActive &&
            "bg-card text-foreground ring-1 ring-border hover:bg-accent",
          !isActive && !trailing && "text-foreground/80 hover:bg-accent",
          disabled && !isActive && "opacity-60",
        );
        if (trailing) {
          return (
            <Link key={f.id} href={newsFlowHref} className={className}>
              <span>{f.label}</span>
              <ChevronRight
                className="h-3.5 w-3.5"
                strokeWidth={2.5}
                aria-hidden
              />
            </Link>
          );
        }
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(f.id)}
            disabled={disabled && !isActive}
            className={className}
          >
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div>
      <div
        className={cn(
          ROW_GRID,
          "border-b px-1 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
        )}
        aria-hidden
      >
        <span>Time</span>
        <span>Instrument</span>
        <span />
        <span>Provider</span>
        <span />
      </div>
      <ul>
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="border-b last:border-b-0">
            <div className={cn(ROW_GRID, "px-1 py-3")}>
              <span className="h-3 w-20 animate-pulse rounded bg-muted" />
              <span className="h-5 w-14 animate-pulse rounded-sm bg-muted" />
              <span className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
              <span className="h-3 w-24 animate-pulse rounded bg-muted" />
              <span className="h-5 w-5 animate-pulse rounded-sm bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewsRow({ item, now }: { item: NewsItem; now: number }) {
  const when = formatWhen(item.publishedAt, now);
  const badge = item.relatedTickers[0] ?? null;

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        ROW_GRID,
        "px-1 py-3 transition-colors hover:bg-accent/40",
      )}
    >
      <span className="text-[13px] text-muted-foreground">{when}</span>
      <span className="min-w-0">
        {badge ? <TickerBadge symbol={badge} /> : null}
      </span>
      <span className="truncate text-[13px] text-foreground">{item.title}</span>
      <span className="truncate text-[13px] text-muted-foreground">
        {item.publisher ?? ""}
      </span>
      {item.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-5 w-5 rounded-sm object-contain"
        />
      ) : (
        <span aria-hidden className="h-5 w-5 rounded-sm bg-muted" />
      )}
    </a>
  );
}

function TickerBadge({ symbol }: { symbol: string }) {
  const color = tickerColor(symbol);
  return (
    <span
      style={{ backgroundColor: color.bg, color: color.fg }}
      className="inline-flex h-[20px] max-w-full items-center rounded-sm px-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide"
    >
      <span className="truncate">{symbol}</span>
    </span>
  );
}

function tickerColor(symbol: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return {
    bg: `hsl(${hue} 70% 88%)`,
    fg: `hsl(${hue} 70% 22%)`,
  };
}

function labelFor(id: CategoryId): string {
  const hit = FILTERS.find((f) => f.id === id);
  return hit ? hit.label : "";
}

const ABSOLUTE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Older-than-a-week stories show an absolute date instead of a relative
// string (matching the spec). Anything more recent uses TradingView-style
// "N minutes/hours/days ago".
function formatWhen(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Math.max(0, now - t);
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay >= 7) return ABSOLUTE_FMT.format(new Date(t));
  if (diffDay >= 1) return `${diffDay} ${diffDay === 1 ? "day" : "days"} ago`;
  if (diffHr >= 1) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  if (diffMin >= 1)
    return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  return "Just now";
}
