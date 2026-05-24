import "server-only";

import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import {
  MarketDataError,
  type Fundamentals,
  type LatestEarnings,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Yahoo's v10 quoteSummary endpoint requires a crumb + cookie pair obtained
// from a prior visit to fc.yahoo.com. We refresh the crumb daily and cache
// the resulting payloads in-process for an hour — fundamentals barely move
// inside a session.
const SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
const CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const CONSENT_URL = "https://fc.yahoo.com";

const MODULES = [
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "earnings",
  "price",
].join(",");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const TIMEOUT_MS = 10_000;
const FUNDAMENTALS_TTL_MS = 60 * 60_000; // 1h
const CRUMB_TTL_MS = 12 * 60 * 60_000; // 12h

interface CrumbState {
  crumb: string;
  cookie: string;
  expiresAt: number;
}

let _crumb: CrumbState | null = null;
let _crumbInflight: Promise<CrumbState | null> | null = null;

const mem = new Map<string, { value: Fundamentals; expiresAt: number }>();
const inflight = new Map<string, Promise<Fundamentals>>();

function yahooSuffix(exchange: Exchange): string {
  return exchange === "BSE" ? ".BO" : ".NS";
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null && "raw" in (v as any)) {
    const raw = (v as any).raw;
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null && "fmt" in (v as any)) {
    const f = (v as any).fmt;
    return typeof f === "string" && f.length > 0 ? f : null;
  }
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function emptyFundamentals(symbol: string, exchange: Exchange): Fundamentals {
  return {
    symbol,
    exchange,
    marketCap: null,
    dividendYieldPct: null,
    trailingPE: null,
    basicEpsTTM: null,
    netIncomeFY: null,
    revenueFY: null,
    floatShares: null,
    beta: null,
    earnings: null,
  };
}

async function yfetch(
  url: string,
  init: RequestInit & { extraHeaders?: Record<string, string> } = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: { ...HEADERS, ...(init.extraHeaders ?? {}) },
      signal: ctrl.signal,
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Walk Yahoo's `set-cookie` headers and concatenate them into a single
 * `Cookie` request header value. We only need name=value pairs; attributes
 * like `Path`, `Expires` etc. are dropped.
 */
function extractCookies(res: Response): string {
  // Node's fetch exposes set-cookie via `getSetCookie()` (Node 19.7+); older
  // runtimes fall back to the comma-joined `set-cookie` header which has
  // ambiguity but is good enough for this single-shot use.
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (() => {
        const v = res.headers.get("set-cookie");
        return v ? [v] : [];
      })();
  return raw
    .map((line) => line.split(";")[0]?.trim() ?? "")
    .filter((s) => s.length > 0)
    .join("; ");
}

async function refreshCrumb(): Promise<CrumbState | null> {
  try {
    const consent = await yfetch(CONSENT_URL);
    const cookie = extractCookies(consent);
    if (!cookie) return null;
    const crumbRes = await yfetch(CRUMB_URL, {
      extraHeaders: { Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 64) return null;
    return { crumb, cookie, expiresAt: Date.now() + CRUMB_TTL_MS };
  } catch {
    return null;
  }
}

async function getCrumb(force = false): Promise<CrumbState | null> {
  if (!force && _crumb && _crumb.expiresAt > Date.now()) return _crumb;
  if (_crumbInflight) return _crumbInflight;
  _crumbInflight = (async () => {
    const next = await refreshCrumb();
    if (next) _crumb = next;
    return next;
  })();
  try {
    return await _crumbInflight;
  } finally {
    _crumbInflight = null;
  }
}

async function fetchSummary(suffixed: string): Promise<any | null> {
  let creds = await getCrumb();
  // First attempt with cached crumb; on 401/403 refresh once and retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    const qs = new URLSearchParams({ modules: MODULES });
    if (creds?.crumb) qs.set("crumb", creds.crumb);
    const url = `${SUMMARY_URL}/${encodeURIComponent(suffixed)}?${qs}`;
    const res = await yfetch(url, {
      extraHeaders: creds?.cookie ? { Cookie: creds.cookie } : {},
    });
    if (res.status === 401 || res.status === 403) {
      if (attempt === 0) {
        creds = await getCrumb(true);
        continue;
      }
      return null;
    }
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body;
  }
  return null;
}

function pickEarnings(earnings: any): LatestEarnings | null {
  if (!earnings || typeof earnings !== "object") return null;
  const quarterly: any[] = Array.isArray(earnings?.earningsChart?.quarterly)
    ? earnings.earningsChart.quarterly
    : [];
  const lastQ = quarterly.length > 0 ? quarterly[quarterly.length - 1] : null;
  const eps = num(lastQ?.actual);
  // earnings.financialsChart.quarterly has revenue per quarter, keyed by the
  // same period label (e.g. "4Q2025") as earningsChart.
  const revQuarterly: any[] = Array.isArray(
    earnings?.financialsChart?.quarterly,
  )
    ? earnings.financialsChart.quarterly
    : [];
  const period = str(lastQ?.date); // e.g. "4Q2025"
  let revenue: number | null = null;
  if (period) {
    const match = revQuarterly.find((q) => str(q?.date) === period);
    revenue = num(match?.revenue);
  }
  if (revenue == null && revQuarterly.length > 0) {
    revenue = num(revQuarterly[revQuarterly.length - 1]?.revenue);
  }
  // Most recent quarter end-date lives on defaultKeyStatistics, but Yahoo
  // also exposes it on price.earningsTimestamp / earnings.earningsDate. We
  // accept the ISO date from defaultKeyStatistics in the caller and merge.
  return {
    reportDate: null,
    period: period ? prettifyPeriod(period) : null,
    eps,
    revenue,
  };
}

/** "4Q2025" → "Q4 2025"; pass through anything that doesn't match. */
function prettifyPeriod(p: string): string {
  const m = /^(\d)Q(\d{4})$/.exec(p);
  return m ? `Q${m[1]} ${m[2]}` : p;
}

function isoFromUnix(sec: unknown): string | null {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseFundamentals(
  symbol: string,
  exchange: Exchange,
  body: any,
): Fundamentals {
  const result = body?.quoteSummary?.result?.[0];
  if (!result) return emptyFundamentals(symbol, exchange);

  const summary = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const finance = result.financialData ?? {};
  const earnings = result.earnings ?? null;

  // Yahoo emits dividendYield as a fraction (0.025 = 2.5%). summaryDetail
  // also has trailingAnnualDividendYield as a fallback.
  const yieldFrac =
    num(summary.dividendYield) ?? num(summary.trailingAnnualDividendYield);
  const dividendYieldPct = yieldFrac == null ? null : yieldFrac * 100;

  const latestEarnings = pickEarnings(earnings);
  const reportDate =
    isoFromUnix(stats.mostRecentQuarter) ??
    isoFromUnix(stats.lastFiscalYearEnd);
  const mergedEarnings: LatestEarnings | null = latestEarnings
    ? { ...latestEarnings, reportDate }
    : reportDate
      ? { reportDate, period: null, eps: null, revenue: null }
      : null;

  return {
    symbol,
    exchange,
    marketCap: num(summary.marketCap) ?? num(result.price?.marketCap),
    dividendYieldPct,
    trailingPE: num(summary.trailingPE),
    basicEpsTTM: num(stats.trailingEps) ?? num(finance.epsTrailingTwelveMonths),
    netIncomeFY: num(stats.netIncomeToCommon),
    revenueFY: num(finance.totalRevenue),
    floatShares: num(stats.floatShares),
    beta: num(stats.beta) ?? num(summary.beta),
    earnings: mergedEarnings,
  };
}

export async function getFundamentals(
  symbol: string,
  exchange: Exchange,
): Promise<Fundamentals> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return emptyFundamentals(sym, exchange);

  const key = `${exchange}:${sym}`;
  const hit = mem.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<Fundamentals> => {
    try {
      await nseBucket.acquire();
      const body = await fetchSummary(`${sym}${yahooSuffix(exchange)}`);
      const value = body
        ? parseFundamentals(sym, exchange, body)
        : emptyFundamentals(sym, exchange);
      mem.set(key, { value, expiresAt: Date.now() + FUNDAMENTALS_TTL_MS });
      return value;
    } catch (err) {
      // Best-effort: a fundamentals failure should never break the page.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[fundamentals] fetch failed", err);
      }
      const value = emptyFundamentals(sym, exchange);
      mem.set(key, {
        value,
        expiresAt: Date.now() + Math.min(FUNDAMENTALS_TTL_MS, 5 * 60_000),
      });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

// Exported for testability; not part of the public surface.
export { MarketDataError };
