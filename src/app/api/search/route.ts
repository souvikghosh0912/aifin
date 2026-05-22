import { NextResponse, type NextRequest } from "next/server";

import { searchSymbols } from "@/lib/market/nse";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ hits: [] });
  if (q.length > 40) {
    return NextResponse.json({ error: "query_too_long" }, { status: 400 });
  }
  const hits = await searchSymbols(q);
  return NextResponse.json({ hits });
}
