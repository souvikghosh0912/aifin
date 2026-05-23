import "server-only";
import path from "node:path";
import os from "node:os";

import { nseBucket } from "./rate-limit";
import { MarketDataError, type TopMover } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TTL_MS = 60_000;
let cache: { value: TopMover[]; expiresAt: number } | null = null;

let _nse: any = null;
async function getNse(): Promise<any> {
  if (_nse) return _nse;
  const mod: any = await import("nse-bse-api");
  const NSE = mod.NSE ?? mod.default?.NSE;
  if (!NSE) throw new MarketDataError("nse-bse-api: NSE export not found");
  _nse = new NSE(
    path.join(os.tmpdir(), "ai-finance-dashboard", "nse-bse-api", "nse"),
    { timeout: 10_000 },
  );
  return _nse;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getTopGainers(): Promise<TopMover[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    await nseBucket.acquire();
    const nse = await getNse();
    const raw: any = await nse.listEquityStocksByIndex("NIFTY 50");
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

    const movers: TopMover[] = list
      .map((r) => ({
        symbol: String(r.symbol ?? r.SYMBOL ?? "").toUpperCase(),
        name: r.meta?.companyName ?? r.companyName ?? r.name ?? null,
        lastPrice: num(r.lastPrice ?? r.last ?? r.ltp),
        changePct: num(r.pChange ?? r.percentChange),
      }))
      .filter((m) => m.symbol.length > 0)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 20);

    cache = { value: movers, expiresAt: Date.now() + TTL_MS };
    return movers;
  } catch {
    return [];
  }
}
