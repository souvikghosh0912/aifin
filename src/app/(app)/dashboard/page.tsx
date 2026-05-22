import Link from "next/link";

import { DashboardSummary } from "@/components/portfolio/dashboard-summary";
import { InvestedChart, type PnlPoint } from "@/components/charts/invested-chart";
import { AddTransactionDialog } from "@/components/portfolio/add-transaction-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [holdingsResult, transactionsResult] = await Promise.all([
    supabase
      .from("holdings_view")
      .select("*")
      .order("invested_value", { ascending: false }),
    supabase
      .from("transactions")
      .select("traded_at, side, quantity, price, fees")
      .order("traded_at", { ascending: true })
      .limit(500),
  ]);

  const holdings = holdingsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];

  // Build a cumulative-invested series for the chart
  const series: PnlPoint[] = [];
  let cum = 0;
  for (const tx of transactions) {
    const flow =
      (tx.side === "BUY" ? 1 : -1) * (tx.quantity * tx.price) + tx.fees;
    cum += flow;
    series.push({
      date: new Date(tx.traded_at).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      invested: Math.max(0, cum),
    });
  }

  if (holdings.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-base font-medium">Your portfolio is empty.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a transaction to start tracking. Live NSE &amp; BSE prices
              will appear automatically.
            </p>
            <div className="flex gap-2">
              <AddTransactionDialog />
              <Link
                href="/markets"
                className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Browse markets
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <AddTransactionDialog />
      </div>

      <DashboardSummary holdings={holdings} />

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Capital deployed
          </h3>
          <p className="num text-sm font-semibold tabular-nums">
            {formatINR(holdings.reduce((s, h) => s + h.invested_value, 0))}
          </p>
        </div>
        <InvestedChart data={series} />
      </section>
    </div>
  );
}
