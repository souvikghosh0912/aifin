import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getQuotes } from "@/lib/market/nse";

export const runtime = "nodejs";

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        symbol: z.string().min(1).max(40),
        exchange: z.enum(["NSE", "BSE"]),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const quotes = await getQuotes(parsed.data.items);
  return NextResponse.json({ quotes });
}
