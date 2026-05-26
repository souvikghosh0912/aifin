"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { CategoryId } from "@/lib/market/news";

interface Props {
  symbol: string;
  name: string | null;
  category: CategoryId;
}

const CATEGORY_LABEL: Record<CategoryId, string> = {
  all: "news",
  "key-facts": "key facts",
  earnings: "earnings",
  "earnings-calls": "earnings calls",
  dividends: "dividends",
  strategy: "strategy",
  mergers: "M&A",
  management: "management",
  esg: "ESG",
  analysts: "analysts",
};

/**
 * Top section of the News Flow page: "News Flow" breadcrumb back to the
 * stock detail page + the large "{SYMBOL} {category}" heading. The
 * category word in the heading reflects whichever filter is active so the
 * page identity changes as the user filters (matches newsflow.png where
 * the heading reads "WIPRO analysts" when Analysts is selected).
 */
export function NewsFlowHeader({ symbol, name, category }: Props) {
  const display = name && name.trim().length > 0 ? name : symbol;
  return (
    <header className="space-y-3 pb-3">
      <Link
        href="/markets"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        News Flow
      </Link>
      <h1 className="flex items-center gap-0.5 text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
        <span className="font-mono uppercase">{symbol}</span>
        <span className="ml-2 font-extrabold">
          {CATEGORY_LABEL[category]}
        </span>
        <ChevronRight
          className="h-6 w-6 -translate-y-px text-foreground"
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="sr-only">{display}</span>
      </h1>
    </header>
  );
}
