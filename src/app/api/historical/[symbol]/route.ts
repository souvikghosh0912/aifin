import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getHistorical } from "@/lib/market/historical";
import { nseBucket } from "@/lib/market/rate-limit";
import { parseExchange } from "@/lib/market/symbols";
import { MarketDataError, type MarketsRange } from "@/lib/market/types";
import { fetchHistoricalYahoo } from "@/lib/market/yahoo";

export const runtime = "nodejs";

const ParamsSchema = z.object({ symbol: z.string().min(1).max(40) });
const RangeSchema = z.enum([
  "1D",
  "1M",
  "3M",
  "6M",
  "1Y",
  "5Y",
  "MAX",
]);

const NARROW_RANGES = new Set<MarketsRange>(["1M", "3M", "6M", "1Y"]);

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
    // Narrow ranges (1M..1Y) go through the cached pipeline. Wider ranges
    // (1D intraday, 5Y, MAX) bypass the historical_cache since its DB column
    // is constrained to the narrow set.
    const range = rangeParsed.data;
    const candles = NARROW_RANGES.has(range)
      ? await getHistorical(
          parsed.data.symbol,
          exchange,
          range as "1M" | "3M" | "6M" | "1Y",
        )
      : await (async () => {
          await nseBucket.acquire();
          return fetchHistoricalYahoo(parsed.data.symbol, exchange, range);
        })();
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
