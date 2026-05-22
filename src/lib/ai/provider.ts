/**
 * AI provider seam. Currently unimplemented — calls throw NotImplementedError.
 *
 * To enable AI features:
 *   1. Set ANTHROPIC_API_KEY in .env.local
 *   2. Implement the methods below (recommended: Anthropic SDK with prompt caching)
 *   3. Update /api/ai/* route handlers to invoke this provider instead of 501
 */

export class NotImplementedError extends Error {
  readonly code = "ai_not_configured";
  constructor(feature: string) {
    super(
      `AI feature "${feature}" is not configured. See src/lib/ai/provider.ts.`,
    );
    this.name = "NotImplementedError";
  }
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PortfolioSnapshot {
  totals: {
    invested: number;
    marketValue: number;
    unrealizedPnl: number;
    dayChange: number;
  };
  holdings: Array<{
    symbol: string;
    exchange: "NSE" | "BSE";
    quantity: number;
    avgCost: number;
    marketValue?: number;
  }>;
  recentTransactions: Array<{
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price: number;
    tradedAt: string;
  }>;
}

export interface AiProvider {
  chat(messages: ChatMessage[], context: PortfolioSnapshot): Promise<string>;
  summarize(
    snapshot: PortfolioSnapshot,
    kind: "weekly" | "monthly",
  ): Promise<string>;
  forecast(snapshot: PortfolioSnapshot): Promise<string>;
}

class StubProvider implements AiProvider {
  async chat(): Promise<string> {
    throw new NotImplementedError("chat");
  }
  async summarize(): Promise<string> {
    throw new NotImplementedError("summarize");
  }
  async forecast(): Promise<string> {
    throw new NotImplementedError("forecast");
  }
}

let _instance: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (_instance) return _instance;
  _instance = new StubProvider();
  return _instance;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
