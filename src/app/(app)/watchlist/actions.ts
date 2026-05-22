"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol, parseExchange } from "@/lib/market/symbols";

const InputSchema = z.object({
  symbol: z.string().min(1).max(40),
  exchange: z.enum(["NSE", "BSE"]),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

const UpdateNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z
    .string()
    .max(500)
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

export async function addWatchlistItem(formData: FormData) {
  const parsed = InputSchema.safeParse({
    symbol: formData.get("symbol"),
    exchange: formData.get("exchange"),
    notes: formData.get("notes"),
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
    notes: parsed.data.notes,
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

export async function updateWatchlistNotes(
  itemId: string,
  notes: string | null,
) {
  const parsed = UpdateNotesSchema.safeParse({ id: itemId, notes });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("watchlist_items")
    .update({ notes: parsed.data.notes })
    .eq("id", parsed.data.id)
    .eq("user_id", claims.sub);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/watchlist");
  return { ok: true };
}
