import { NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "ai_not_configured",
      message: isAiConfigured()
        ? "AI provider has a key but is not implemented. See src/lib/ai/provider.ts."
        : "Set ANTHROPIC_API_KEY in .env.local and implement src/lib/ai/provider.ts.",
    },
    { status: 501 },
  );
}
