import { AddWatchlistDialog } from "@/components/watchlist/add-watchlist-dialog";
import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watchlist_items")
    .select("*")
    .order("added_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Track symbols without holding them.
          </p>
        </div>
        <AddWatchlistDialog />
      </div>
      <WatchlistTable items={data ?? []} />
    </div>
  );
}
