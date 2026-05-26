import "server-only";
import path from "node:path";
import os from "node:os";

import type { Exchange } from "@/types/database";

import { nseBucket } from "./rate-limit";
import { normalizeSymbol } from "./symbols";
import type { CompanyProfile } from "./types";
import { MarketDataError } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fetches the "About" payload shown on /stocks/[symbol]. We pull as much from
 * Yahoo's `assetProfile` module as possible (sector, industry, website, HQ,
 * officers, longBusinessSummary, founded) and overlay NSE's metadata for
 * exchange-registry fields (ISIN, listing date). Everything is best-effort —
 * a profile fetch failure should never break the page, so fields fall back
 * to `null` and the UI shows an em-dash.
 */

const SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
const CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const CONSENT_URL = "https://fc.yahoo.com";
const MODULES = "assetProfile,summaryProfile,quoteType";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const TIMEOUT_MS = 10_000;
const PROFILE_TTL_MS = 24 * 60 * 60_000; // 24h — profile data barely changes
const CRUMB_TTL_MS = 12 * 60 * 60_000;

interface CrumbState {
  crumb: string;
  cookie: string;
  expiresAt: number;
}

let _crumb: CrumbState | null = null;
let _crumbInflight: Promise<CrumbState | null> | null = null;

const mem = new Map<string, { value: CompanyProfile; expiresAt: number }>();
const inflight = new Map<string, Promise<CompanyProfile>>();

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

function yahooSuffix(exchange: Exchange): string {
  return exchange === "BSE" ? ".BO" : ".NS";
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function emptyProfile(symbol: string, exchange: Exchange): CompanyProfile {
  return {
    symbol,
    exchange,
    sector: null,
    industry: null,
    ceo: null,
    website: null,
    headquarters: null,
    founded: null,
    ipoDate: null,
    isin: null,
    cfiCode: null,
    description: null,
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

function extractCookies(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw =
    typeof headers.getSetCookie === "function"
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
    const crumbRes = await yfetch(CRUMB_URL, { extraHeaders: { Cookie: cookie } });
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

async function fetchYahooSummary(suffixed: string): Promise<any | null> {
  let creds = await getCrumb();
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
    return await res.json().catch(() => null);
  }
  return null;
}

/** Strip protocol and trailing slash, lowercase host. */
function normalizeWebsite(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  return s.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

function pickCeo(officers: unknown): string | null {
  if (!Array.isArray(officers)) return null;
  // Prefer titles that explicitly include "Chief Executive" or "CEO".
  for (const o of officers) {
    const title = str((o as any)?.title);
    const name = str((o as any)?.name);
    if (!title || !name) continue;
    if (/chief executive|ceo\b/i.test(title)) return name;
  }
  return null;
}

/** Yahoo's quoteType.firstTradeDateEpochUtc is in seconds since epoch. */
function isoFromUnixSec(sec: unknown): string | null {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** NSE returns listingDate as "DD-MMM-YYYY" (e.g. "08-Nov-1995"). */
function parseNseListingDate(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (!m) return null;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIdx = months.findIndex(
    (mo) => mo.toLowerCase() === m[2]!.toLowerCase(),
  );
  if (monthIdx < 0) return null;
  return `${m[3]}-${String(monthIdx + 1).padStart(2, "0")}-${m[1]}`;
}

interface YahooParsed {
  sector: string | null;
  industry: string | null;
  ceo: string | null;
  website: string | null;
  headquarters: string | null;
  founded: number | null;
  ipoDate: string | null;
  description: string | null;
}

function parseYahoo(body: any): YahooParsed | null {
  const result = body?.quoteSummary?.result?.[0];
  if (!result) return null;
  const profile = result.assetProfile ?? result.summaryProfile ?? {};
  const quoteType = result.quoteType ?? {};
  const ceo = pickCeo(profile.companyOfficers);
  const founded = (() => {
    // Yahoo doesn't expose `founded` directly. Some payloads include it on
    // assetProfile.founded as a string; otherwise it stays null.
    const n = Number(profile.founded);
    return Number.isFinite(n) && n > 1500 && n < 3000 ? n : null;
  })();
  return {
    sector: str(profile.sector),
    industry: str(profile.industry),
    ceo,
    website: normalizeWebsite(profile.website),
    headquarters: str(profile.city) ?? str(profile.address1) ?? null,
    founded,
    ipoDate: isoFromUnixSec(quoteType.firstTradeDateEpochUtc),
    description: str(profile.longBusinessSummary),
  };
}

interface NseParsed {
  sector: string | null;
  industry: string | null;
  isin: string | null;
  ipoDate: string | null;
}

async function fetchNseProfile(sym: string): Promise<NseParsed | null> {
  try {
    await nseBucket.acquire();
    const nse = await getNse();
    const raw: any = await nse.getEquityMetaInfo(sym);
    if (!raw || typeof raw !== "object") return null;
    return {
      sector: str(raw.industryInfo?.sector) ?? str(raw.industryInfo?.macro),
      industry:
        str(raw.industryInfo?.basicIndustry) ?? str(raw.industryInfo?.industry),
      isin: str(raw.metadata?.isin) ?? str(raw.info?.isin),
      ipoDate: parseNseListingDate(raw.metadata?.listingDate),
    };
  } catch {
    return null;
  }
}

export async function getCompanyProfile(
  symbol: string,
  exchange: Exchange,
): Promise<CompanyProfile> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return emptyProfile(sym, exchange);

  const key = `${exchange}:${sym}`;
  const hit = mem.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<CompanyProfile> => {
    try {
      const [yahooBody, nseInfo] = await Promise.all([
        fetchYahooSummary(`${sym}${yahooSuffix(exchange)}`),
        exchange === "NSE"
          ? fetchNseProfile(sym)
          : Promise.resolve<NseParsed | null>(null),
      ]);
      const y = yahooBody ? parseYahoo(yahooBody) : null;
      const value: CompanyProfile = {
        symbol: sym,
        exchange,
        // Prefer NSE classifications when present — they're the canonical
        // exchange-registry values for Indian listings.
        sector: nseInfo?.sector ?? y?.sector ?? null,
        industry: nseInfo?.industry ?? y?.industry ?? null,
        ceo: y?.ceo ?? null,
        website: y?.website ?? null,
        headquarters: y?.headquarters ?? null,
        founded: y?.founded ?? null,
        ipoDate: nseInfo?.ipoDate ?? y?.ipoDate ?? null,
        isin: nseInfo?.isin ?? null,
        cfiCode: null,
        description: y?.description ?? null,
      };
      mem.set(key, { value, expiresAt: Date.now() + PROFILE_TTL_MS });
      return value;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[profile] fetch failed", err);
      }
      const value = emptyProfile(sym, exchange);
      mem.set(key, {
        value,
        expiresAt: Date.now() + Math.min(PROFILE_TTL_MS, 5 * 60_000),
      });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
