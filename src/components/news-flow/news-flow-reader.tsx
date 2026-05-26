"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchArticle } from "@/components/stocks/news-actions";
import type { Article } from "@/lib/market/article";
import type { NewsItem } from "@/lib/market/news";
import { cn } from "@/lib/utils";

interface Props {
  item: NewsItem | null;
  /** When true, render only the headline + meta. No body, no fetch. */
  flash?: boolean;
}

const FULL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Middle column of the News Flow page — the article reader for whichever
 * headline is selected in <NewsFlowList>. Fetches the publisher page via a
 * server action and runs it through Mozilla Readability to extract the body
 * + images, then renders inline. When extraction fails (paywall, JS-only
 * publisher pages, blocked scrapers) we fall back to a clear external CTA.
 */
export function NewsFlowReader({ item, flash = false }: Props) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setArticle(null);
    setErrored(false);
    if (!item || flash) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchArticle(item.link)
      .then((a) => {
        if (cancelled) return;
        if (a && a.contentHtml.trim().length > 0) {
          setArticle(a);
        } else {
          setErrored(true);
        }
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item, flash]);

  if (!item) {
    return (
      <div className="grid min-h-0 place-items-center overflow-y-auto rounded-md border bg-card text-sm text-muted-foreground">
        Select a headline on the left to read it here.
      </div>
    );
  }

  const when = FULL_FMT.format(new Date(item.publishedAt));

  return (
    <article className="min-h-0 overflow-y-auto rounded-md border bg-card">
      <div className="space-y-5 p-6">
        <PublisherBlock name={item.publisher} favicon={item.thumbnail} />

        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-foreground">
          {article?.title ?? item.title}
        </h2>

        <p className="text-[12px] text-muted-foreground">
          {when}
          {article?.byline ? (
            <>
              <span className="px-1.5">·</span>
              <span>{article.byline}</span>
            </>
          ) : (
            <>
              <span className="px-1.5">·</span>
              <span>{article?.siteName ?? "Refinitiv Eikon News"}</span>
            </>
          )}
          {article?.readingTimeMin ? (
            <>
              <span className="px-1.5">·</span>
              <span>{article.readingTimeMin} min read</span>
            </>
          ) : null}
        </p>

        {item.relatedTickers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {item.relatedTickers.map((t) => (
              <span
                key={t}
                className="inline-flex h-[22px] items-center rounded-sm bg-accent px-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {flash ? null : (
          <div className="border-t pt-5">
            {loading ? (
              <ArticleSkeleton />
            ) : article ? (
              <ArticleBody html={article.contentHtml} url={article.url} publisher={item.publisher} />
            ) : (
              <ArticleFallback url={item.link} publisher={item.publisher} errored={errored} />
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function PublisherBlock({
  name,
  favicon,
}: {
  name: string | null;
  favicon: string | null;
}) {
  if (!name) return null;
  return (
    <div className="flex items-center gap-2">
      {favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={favicon}
          alt=""
          referrerPolicy="no-referrer"
          className="h-5 w-5 rounded-sm object-contain"
        />
      ) : null}
      <span className="text-[13px] font-semibold uppercase tracking-wide text-foreground">
        {name}
      </span>
    </div>
  );
}

// Tailwind arbitrary descendant selectors style the publisher HTML that
// Readability hands us without dragging in @tailwindcss/typography. Tuned
// to match the rest of the reader (13px body copy, modest headings,
// inline-friendly images).
const PROSE_CLASSES = cn(
  "text-[13px] leading-relaxed text-foreground",
  "[&_p]:my-3 [&_p]:text-[13px] [&_p]:leading-relaxed",
  "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-[18px] [&_h1]:font-bold",
  "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-[16px] [&_h2]:font-bold",
  "[&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-[14px] [&_h3]:font-semibold",
  "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:text-[13px] [&_h4]:font-semibold",
  "[&_a]:text-primary [&_a]:underline hover:[&_a]:no-underline",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-1",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_img]:my-4 [&_img]:mx-auto [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md",
  "[&_figure]:my-4 [&_figure]:mx-auto [&_figure]:max-w-full",
  "[&_figcaption]:mt-1.5 [&_figcaption]:text-[11px] [&_figcaption]:text-muted-foreground",
  "[&_hr]:my-6 [&_hr]:border-border",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-[12px]",
  "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px]",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
);

function ArticleBody({
  html,
  url,
  publisher,
}: {
  html: string;
  url: string;
  publisher: string | null;
}) {
  return (
    <div className="space-y-5">
      <div
        className={PROSE_CLASSES}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="border-t pt-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          <span>
            Continue on {publisher ?? "publisher"}
          </span>
          <ExternalLink className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </a>
      </div>
    </div>
  );
}

function ArticleFallback({
  url,
  publisher,
  errored,
}: {
  url: string;
  publisher: string | null;
  errored: boolean;
}) {
  return (
    <>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {errored
          ? "Inline preview isn't available for this article right now — open it at the publisher to read the full story."
          : "Full article text is hosted by the publisher. Open the link below to read the complete story on their site."}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-[13px] font-semibold text-background transition-colors hover:bg-foreground/90"
      >
        <span>
          Read full article{publisher ? ` on ${publisher}` : ""}
        </span>
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </a>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div className="space-y-3">
      <span className="block h-3 w-full animate-pulse rounded bg-muted" />
      <span className="block h-3 w-[92%] animate-pulse rounded bg-muted" />
      <span className="block h-3 w-[88%] animate-pulse rounded bg-muted" />
      <span className="my-4 block h-40 w-full animate-pulse rounded-md bg-muted" />
      <span className="block h-3 w-full animate-pulse rounded bg-muted" />
      <span className="block h-3 w-[95%] animate-pulse rounded bg-muted" />
      <span className="block h-3 w-[78%] animate-pulse rounded bg-muted" />
    </div>
  );
}
