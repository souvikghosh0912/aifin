import { Suspense } from "react";

import { SymbolSearch } from "@/components/markets/symbol-search";
import { IndicesPanel } from "@/components/markets/indices-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
        <p className="text-sm text-muted-foreground">
          Search NSE/BSE listed equities and browse key indices.
        </p>
      </div>

      <SymbolSearch />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <IndicesPanel />
      </Suspense>
    </div>
  );
}
