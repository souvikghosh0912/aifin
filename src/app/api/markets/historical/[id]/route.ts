import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { fetchMarketHistorical, findMarketEntry } from "@/lib/market/markets";
import { MarketDataError } from "@/lib/market/types";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().min(1).max(48) });
const RangeSchema = z.enum(["1D", "1M", "3M", "6M", "1Y", "5Y", "MAX"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const entry = findMarketEntry(parsed.data.id);
  if (!entry) {
    return NextResponse.json({ error: "unknown_market" }, { status: 404 });
  }
  const rangeRaw = request.nextUrl.searchParams.get("range") ?? "1M";
  const rangeParsed = RangeSchema.safeParse(rangeRaw);
  if (!rangeParsed.success) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  try {
    const candles = await fetchMarketHistorical(entry, rangeParsed.data);
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
