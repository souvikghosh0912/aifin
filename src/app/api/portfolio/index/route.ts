import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const [holdingsResult, watchlistResult] = await Promise.all([
    supabase
      .from("holdings_view")
      .select("symbol, exchange")
      .order("invested_value", { ascending: false }),
    supabase
      .from("watchlist_items")
      .select("symbol, exchange")
      .order("added_at", { ascending: false }),
  ]);

  return NextResponse.json({
    holdings: holdingsResult.data ?? [],
    watchlist: watchlistResult.data ?? [],
  });
}
