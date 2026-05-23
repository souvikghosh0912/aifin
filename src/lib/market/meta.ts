import "server-only";
import path from "node:path";
import os from "node:os";

import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import { MarketDataError, type MetaInfo } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TTL_MS = 60 * 60_000;
const mem = new Map<string, { value: MetaInfo; expiresAt: number }>();

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

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emptyMeta(symbol: string, exchange: Exchange): MetaInfo {
  return {
    symbol: normalizeSymbol(symbol),
    exchange,
    name: null,
    industry: null,
    marketCap: null,
  };
}

export async function getMetaInfo(
  symbol: string,
  exchange: Exchange,
): Promise<MetaInfo> {
  const sym = normalizeSymbol(symbol);
  if (exchange === "BSE") return emptyMeta(sym, exchange);

  const key = `${exchange}:${sym}`;
  const hit = mem.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    await nseBucket.acquire();
    const nse = await getNse();
    const raw: any = await nse.getEquityMetaInfo(sym);
    if (!raw || typeof raw !== "object") {
      const v = emptyMeta(sym, exchange);
      mem.set(key, { value: v, expiresAt: Date.now() + TTL_MS });
      return v;
    }
    const issued = num(raw.securityInfo?.issuedSize);
    const face = num(raw.securityInfo?.faceValue);
    const last = num(raw.priceInfo?.lastPrice ?? raw.priceInfo?.ltp);
    const marketCap =
      num(raw.marketCap) ??
      (issued != null && last != null
        ? issued * last
        : issued != null && face != null
          ? issued * face
          : null);

    const value: MetaInfo = {
      symbol: sym,
      exchange,
      name: raw.info?.companyName ?? raw.companyName ?? null,
      industry: raw.industryInfo?.industry ?? raw.industry ?? null,
      marketCap,
    };
    mem.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch {
    return emptyMeta(sym, exchange);
  }
}
