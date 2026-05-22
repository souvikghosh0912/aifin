"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { TransactionInputSchema } from "@/lib/validation/transaction";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function addTransaction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const parsed = TransactionInputSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { data: portfolio, error: pErr } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", claims.sub)
    .eq("is_default", true)
    .maybeSingle();
  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  let portfolioId = portfolio?.id;
  if (!portfolioId) {
    const { data: createdPortfolio, error: createErr } = await supabase
      .from("portfolios")
      .insert({
        user_id: claims.sub,
        name: "Default Portfolio",
        is_default: true,
      })
      .select("id")
      .single();

    if (createErr || !createdPortfolio) {
      return {
        ok: false,
        error: createErr?.message ?? "Could not create a default portfolio",
      };
    }

    portfolioId = createdPortfolio.id;
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: claims.sub,
    portfolio_id: portfolioId,
    symbol: parsed.data.symbol,
    exchange: parsed.data.exchange,
    side: parsed.data.side,
    quantity: parsed.data.quantity,
    price: parsed.data.price,
    fees: parsed.data.fees,
    traded_at: new Date(parsed.data.traded_at).toISOString(),
    notes: parsed.data.notes ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", claims.sub);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  return { ok: true };
}
