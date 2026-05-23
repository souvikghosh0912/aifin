import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getHistorical } from "@/lib/market/historical";
import { parseExchange } from "@/lib/market/symbols";
import { MarketDataError } from "@/lib/market/types";

export const runtime = "nodejs";

const ParamsSchema = z.object({ symbol: z.string().min(1).max(40) });
const RangeSchema = z.enum(["1M", "3M", "6M", "1Y"]);

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
  const rangeRaw = request.nextUrl.searchParams.get("range") ?? "3M";
  const rangeParsed = RangeSchema.safeParse(rangeRaw);
  if (!rangeParsed.success) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  try {
    const candles = await getHistorical(
      parsed.data.symbol,
      exchange,
      rangeParsed.data,
    );
    return NextResponse.json(
      { candles },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    const message =
      err instanceof MarketDataError ? err.message : "fetch_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
