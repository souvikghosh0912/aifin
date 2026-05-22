import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getIndices } from "@/lib/market/nse";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export async function IndicesPanel() {
  const indices = await getIndices();
  if (indices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Index data unavailable right now.
        </CardContent>
      </Card>
    );
  }
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        Indices
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {indices.map((idx) => {
          const up = idx.change >= 0;
          return (
            <Card key={idx.name}>
              <CardContent className="p-4">
                <p className="truncate text-xs text-muted-foreground">
                  {idx.name}
                </p>
                <p className="num mt-1 text-lg font-semibold">
                  {formatNumber(idx.last)}
                </p>
                <p
                  className={cn(
                    "num mt-1 inline-flex items-center gap-1 text-xs",
                    up ? "text-success" : "text-destructive",
                  )}
                >
                  {up ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatNumber(idx.change)} (
                  {formatPercent(idx.changePct)})
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
