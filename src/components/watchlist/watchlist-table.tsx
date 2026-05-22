"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { removeWatchlistItem } from "@/app/(app)/watchlist/actions";
import type { Quote } from "@/lib/market/types";
import { cn, formatINR, formatPercent } from "@/lib/utils";
import type { Tables } from "@/types/database";

type WatchlistItem = Tables<"watchlist_items">;

async function fetchQuotes(items: WatchlistItem[]) {
  if (items.length === 0) return {};
  const res = await fetch("/api/quotes/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((i) => ({ symbol: i.symbol, exchange: i.exchange })),
    }),
  });
  if (!res.ok) throw new Error("quote_fetch_failed");
  const json = (await res.json()) as {
    quotes: Record<string, Quote | { error: string }>;
  };
  return json.quotes;
}

export function WatchlistTable({ items }: { items: WatchlistItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { data, isLoading } = useQuery({
    queryKey: [
      "watchlist-quotes",
      items.map((i) => `${i.exchange}:${i.symbol}`).sort().join(","),
    ],
    queryFn: () => fetchQuotes(items),
    enabled: items.length > 0,
    refetchInterval: 30_000,
  });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your watchlist is empty. Add symbols you want to track.
        </p>
      </div>
    );
  }

  const onRemove = (id: string) => {
    start(async () => {
      const res = await removeWatchlistItem(id);
      if (res.ok) {
        toast.success("Removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">LTP</TableHead>
            <TableHead className="text-right">Day change</TableHead>
            <TableHead className="text-right">Prev close</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const key = `${item.exchange}:${item.symbol}`;
            const raw = data?.[key];
            const quote =
              raw && "lastPrice" in (raw as object) ? (raw as Quote) : null;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.symbol}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.exchange}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="num text-right">
                  {isLoading && !quote ? (
                    <Skeleton className="ml-auto h-4 w-16" />
                  ) : quote ? (
                    formatINR(quote.lastPrice)
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "num text-right",
                    quote && quote.change > 0 && "text-success",
                    quote && quote.change < 0 && "text-destructive",
                  )}
                >
                  {quote ? (
                    <>
                      {formatINR(quote.change)}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatPercent(quote.changePct)})
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="num text-right text-muted-foreground">
                  {quote ? formatINR(quote.previousClose) : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    disabled={pending}
                    aria-label="Remove from watchlist"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
