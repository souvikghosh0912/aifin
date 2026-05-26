import "server-only";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import { MarketDataError } from "./types";

export interface Article {
  title: string | null;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  /** Sanitized article HTML, ready to drop into the reader via innerHTML. */
  contentHtml: string;
  /** First image scraped from the article body — used as a poster shot. */
  leadImage: string | null;
  readingTimeMin: number | null;
  /** Final publisher URL after Google News redirect resolution. */
  url: string;
}

const TIMEOUT_MS = 20_000;
const TTL_MS = 30 * 60_000;
const MAX_HTML_BYTES = 4_000_000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const mem = new Map<string, { value: Article; expiresAt: number }>();
const inflight = new Map<string, Promise<Article | null>>();

function debug(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[article]", ...args);
  }
}

function makeTimer(ms: number = TIMEOUT_MS): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return {
    signal: ctrl.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const { signal, cancel } = makeTimer();
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new MarketDataError(`Article fetch ${res.status} ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new MarketDataError(`Article payload too large (${buf.byteLength}B)`);
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { html, finalUrl: res.url };
  } catch (err) {
    if (err instanceof MarketDataError) throw err;
    if ((err as { name?: string })?.name === "AbortError") {
      throw new MarketDataError(`Article fetch timed out after ${TIMEOUT_MS}ms`);
    }
    throw new MarketDataError("Article fetch failed", err);
  } finally {
    cancel();
  }
}

function pickLeadImage(html: string): string | null {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m?.[1] ?? null;
}

function readingTimeFor(textContent: string | null): number | null {
  if (!textContent) return null;
  const words = textContent.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

function stripTagsApprox(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Readability already strips most cruft; this is a final guard against
// anything that slips through (event handlers, embedded scripts, etc.).
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');
}

/**
 * Primary extraction path: Jina Reader (r.jina.ai).
 *
 * Jina handles Google News redirects, JS-rendered publisher pages, and
 * most paywalls out of the box. Free tier with no API key; rate-limited
 * but generous for single-user dashboards. Asking for HTML output (via
 * X-Return-Format) means we don't need a markdown renderer on this side.
 */
async function extractViaJina(rawUrl: string): Promise<Article | null> {
  const endpoint = `https://r.jina.ai/${rawUrl}`;
  const { signal, cancel } = makeTimer();
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Return-Format": "html",
      },
      signal,
      redirect: "follow",
    });
    if (!res.ok) {
      debug("jina failed", res.status, res.statusText);
      return null;
    }
    const json: unknown = await res.json();
    if (!json || typeof json !== "object") return null;
    const data = (json as { data?: Record<string, unknown> }).data;
    if (!data) return null;
    const content = typeof data.content === "string" ? data.content : null;
    if (!content || content.trim().length === 0) {
      debug("jina returned empty content");
      return null;
    }
    const contentHtml = sanitize(content);
    return {
      title: typeof data.title === "string" ? data.title : null,
      byline: null,
      siteName:
        typeof data.publisher === "string"
          ? data.publisher
          : typeof data.siteName === "string"
            ? data.siteName
            : null,
      excerpt:
        typeof data.description === "string" ? data.description : null,
      contentHtml,
      leadImage: pickLeadImage(contentHtml),
      readingTimeMin: readingTimeFor(stripTagsApprox(contentHtml)),
      url: typeof data.url === "string" ? data.url : rawUrl,
    };
  } catch (err) {
    debug("jina threw", err);
    return null;
  } finally {
    cancel();
  }
}

function extractGoogleNewsArticleId(url: string): string | null {
  const m = /\/(?:rss\/)?articles\/([^?/]+)/.exec(url);
  return m?.[1] ?? null;
}

/**
 * Fallback: decode the Google News URL ourselves and run Mozilla
 * Readability on the publisher page. Used when Jina rate-limits us or is
 * unreachable. The signed-RPC dance mirrors what news.google.com sends
 * from the article page itself.
 */
async function decodeGoogleNewsUrl(googleUrl: string): Promise<string | null> {
  const articleId = extractGoogleNewsArticleId(googleUrl);
  if (!articleId) return null;

  let landingHtml: string;
  try {
    const { signal, cancel } = makeTimer();
    try {
      const res = await fetch(`https://news.google.com/articles/${articleId}`, {
        headers: BROWSER_HEADERS,
        signal,
        redirect: "follow",
      });
      if (!res.ok) {
        debug("gnews landing", res.status);
        return null;
      }
      landingHtml = await res.text();
    } finally {
      cancel();
    }
  } catch (err) {
    debug("gnews landing threw", err);
    return null;
  }

  const sigMatch = /data-n-a-sg="([^"]+)"/.exec(landingHtml);
  const tsMatch = /data-n-a-ts="([^"]+)"/.exec(landingHtml);
  if (!sigMatch?.[1] || !tsMatch?.[1]) {
    debug("gnews missing sig/ts");
    return null;
  }

  const articlesReq: [string, string] = [
    "Fbv4je",
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${articleId}",${tsMatch[1]},"${sigMatch[1]}"]`,
  ];
  const fReq = JSON.stringify([[articlesReq]]);
  const body = `f.req=${encodeURIComponent(fReq)}`;

  let decodeText: string;
  try {
    const { signal, cancel } = makeTimer();
    try {
      const res = await fetch(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
        {
          method: "POST",
          headers: {
            ...BROWSER_HEADERS,
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body,
          signal,
        },
      );
      if (!res.ok) {
        debug("gnews batchexecute", res.status);
        return null;
      }
      decodeText = await res.text();
    } finally {
      cancel();
    }
  } catch (err) {
    debug("gnews batchexecute threw", err);
    return null;
  }

  try {
    const stripped = decodeText.replace(/^\)\]\}'\s*/, "");
    const firstJsonEnd = stripped.indexOf("\n");
    const firstJson =
      firstJsonEnd === -1 ? stripped : stripped.slice(0, firstJsonEnd);
    const outer: unknown = JSON.parse(firstJson);
    if (!Array.isArray(outer)) return null;
    const entry = outer.find(
      (e: unknown): e is [string, string, string] =>
        Array.isArray(e) &&
        e[0] === "wrb.fr" &&
        e[1] === "Fbv4je" &&
        typeof e[2] === "string",
    );
    if (!entry) return null;
    const inner: unknown = JSON.parse(entry[2]);
    if (!Array.isArray(inner)) return null;
    const url = inner[1];
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
  } catch (err) {
    debug("gnews parse threw", err);
    return null;
  }
}

async function extractViaReadability(
  publisherUrl: string,
): Promise<Article | null> {
  try {
    const { html, finalUrl } = await fetchHtml(publisherUrl);
    if (finalUrl.includes("news.google.com")) return null;
    const dom = new JSDOM(html, { url: finalUrl });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    if (!parsed || !parsed.content) return null;
    const contentHtml = sanitize(parsed.content);
    return {
      title: parsed.title ?? null,
      byline: parsed.byline ?? null,
      siteName: parsed.siteName ?? null,
      excerpt: parsed.excerpt ?? null,
      contentHtml,
      leadImage: pickLeadImage(contentHtml),
      readingTimeMin: readingTimeFor(parsed.textContent ?? null),
      url: finalUrl,
    };
  } catch (err) {
    debug("readability threw", err);
    return null;
  }
}

/**
 * Fetch a publisher page and return clean HTML + first image for the
 * News Flow reader. Tries Jina Reader first (handles Google News
 * redirects, paywalls, JS pages reliably); falls back to decoding the
 * Google News URL ourselves and running Mozilla Readability on the
 * publisher page when Jina is unavailable or rate-limits us. Cached
 * 30 min per URL. Returns null when both paths fail.
 */
export async function getArticle(rawUrl: string): Promise<Article | null> {
  if (!rawUrl) return null;
  const key = rawUrl;
  const hit = mem.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<Article | null> => {
    try {
      const viaJina = await extractViaJina(rawUrl);
      if (viaJina && viaJina.contentHtml.trim().length > 200) {
        mem.set(key, { value: viaJina, expiresAt: Date.now() + TTL_MS });
        return viaJina;
      }

      if (rawUrl.includes("news.google.com")) {
        const decoded = await decodeGoogleNewsUrl(rawUrl);
        if (decoded) {
          const viaReadability = await extractViaReadability(decoded);
          if (viaReadability) {
            mem.set(key, {
              value: viaReadability,
              expiresAt: Date.now() + TTL_MS,
            });
            return viaReadability;
          }
        }
      } else {
        const viaReadability = await extractViaReadability(rawUrl);
        if (viaReadability) {
          mem.set(key, {
            value: viaReadability,
            expiresAt: Date.now() + TTL_MS,
          });
          return viaReadability;
        }
      }

      debug("all extraction paths failed for", rawUrl);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
