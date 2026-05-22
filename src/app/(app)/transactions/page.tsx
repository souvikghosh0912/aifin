import { AddTransactionDialog } from "@/components/portfolio/add-transaction-dialog";
import { TransactionsTable } from "@/components/portfolio/transactions-table";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("traded_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Every buy and sell across your portfolio.
          </p>
        </div>
        <AddTransactionDialog />
      </div>
      <TransactionsTable transactions={transactions ?? []} />
    </div>
  );
}
