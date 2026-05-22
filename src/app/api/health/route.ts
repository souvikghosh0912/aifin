import { NextResponse } from "next/server";

import { getQuote } from "@/lib/market/nse";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  ok: boolean;
  message?: string;
}

async function checkDb(): Promise<CheckResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return error ? { ok: false, message: error.message } : { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "unknown",
    };
  }
}

async function checkUpstream(): Promise<CheckResult> {
  try {
    await getQuote("RELIANCE", "NSE");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function GET() {
  const [db, upstream] = await Promise.all([checkDb(), checkUpstream()]);
  const ok = db.ok && upstream.ok;
  return NextResponse.json(
    {
      ok,
      version: process.env.npm_package_version ?? "0.1.0",
      checks: { db, upstream },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
