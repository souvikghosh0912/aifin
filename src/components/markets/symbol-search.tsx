"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SymbolSearchHit } from "@/lib/market/types";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SymbolSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SymbolSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(q, 250);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setHits([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as
          | { hits?: SymbolSearchHit[]; error?: string }
          | null;
        if (cancelled) return;
        if (!r.ok || body?.error) {
          setHits([]);
          setError("Search is temporarily unavailable. Try again in a moment.");
          return;
        }
        setHits(body?.hits ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setHits([]);
        setError("Search is temporarily unavailable. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const showResults = useMemo(() => q.trim().length > 0, [q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search NSE/BSE symbols (e.g. RELIANCE, TCS, ITC)"
          className="pl-9"
        />
      </div>
      {showResults && (
        <Card>
          <CardContent className="p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="px-3 py-6 text-center text-sm text-destructive">
                {error}
              </p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matches for &quot;{debounced}&quot;.
              </p>
            ) : (
              <ul className="divide-y">
                {hits.map((h) => (
                  <li key={`${h.exchange}:${h.symbol}`}>
                    <Link
                      href={
                        `/stocks/${encodeURIComponent(h.symbol)}?exchange=${h.exchange}` as Route
                      }
                      className="flex items-center justify-between px-3 py-2 hover:bg-accent"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{h.symbol}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {h.exchange}
                          </Badge>
                        </div>
                        {h.name ? (
                          <p className="text-xs text-muted-foreground">
                            {h.name}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
