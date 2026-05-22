import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { AddTransactionDialog } from "@/components/portfolio/add-transaction-dialog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const supabase = await createClient();
  const { data: holdings } = await supabase
    .from("holdings_view")
    .select("*")
    .order("invested_value", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Holdings</h1>
          <p className="text-sm text-muted-foreground">
            Open positions with live NSE/BSE prices. Refreshes every 30s.
          </p>
        </div>
        <AddTransactionDialog />
      </div>
      <HoldingsTable holdings={holdings ?? []} />
    </div>
  );
}
