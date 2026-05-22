"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol, parseExchange } from "@/lib/market/symbols";

const InputSchema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["NSE", "BSE"]),
});

export async function addWatchlistItem(formData: FormData) {
  const parsed = InputSchema.safeParse({
    symbol: formData.get("symbol"),
    exchange: formData.get("exchange"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("watchlist_items").insert({
    user_id: claims.sub,
    symbol: normalizeSymbol(parsed.data.symbol),
    exchange: parseExchange(parsed.data.exchange),
  });
  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/watchlist");
  return { ok: true };
}

export async function removeWatchlistItem(id: string) {
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", claims.sub);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/watchlist");
  return { ok: true };
}
