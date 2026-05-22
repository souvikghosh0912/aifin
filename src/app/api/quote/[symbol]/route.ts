import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getQuote } from "@/lib/market/nse";
import { parseExchange } from "@/lib/market/symbols";
import { MarketDataError } from "@/lib/market/types";

export const runtime = "nodejs";

const ParamsSchema = z.object({ symbol: z.string().min(1).max(40) });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  const params = await context.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const exchange = parseExchange(request.nextUrl.searchParams.get("exchange"));

  try {
    const quote = await getQuote(parsed.data.symbol, exchange);
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (err) {
    const message =
      err instanceof MarketDataError ? err.message : "fetch_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
