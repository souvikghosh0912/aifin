"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * TradingView-style horizontal tab strip. Functional tabs scroll to in-page
 * anchors; placeholder tabs (Financials, News, etc.) ship as visual stubs
 * that toast a "coming soon" hint on click. Active state is driven by an
 * IntersectionObserver on the functional anchors so the underline tracks
 * the user's scroll position.
 */
interface TabDef {
  id: string;
  label: string;
  /** When false, the tab is a visual placeholder and pops a toast on click. */
  functional: boolean;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", functional: true },
  { id: "financials", label: "Financials", functional: false },
  { id: "news", label: "News", functional: false },
  { id: "ideas", label: "Ideas", functional: false },
  { id: "community", label: "Community", functional: false },
  { id: "technicals", label: "Technicals", functional: true },
  { id: "forecasts", label: "Forecasts", functional: false },
  { id: "seasonals", label: "Seasonals", functional: false },
  { id: "options", label: "Options", functional: false },
  { id: "bonds", label: "Bonds", functional: false },
  { id: "etfs", label: "ETFs", functional: false },
];

const FUNCTIONAL_IDS = TABS.filter((t) => t.functional).map((t) => t.id);

export function StockTabs() {
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const sections = FUNCTIONAL_IDS.map((id) =>
      document.getElementById(id),
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      className="-mx-0.5 flex items-center gap-0 overflow-x-auto border-b text-[13px]"
      aria-label="Stock page sections"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const className = cn(
          "relative shrink-0 px-3 py-2.5 font-normal text-muted-foreground transition-colors hover:text-foreground",
          isActive && "font-semibold text-foreground",
        );
        const underline = (
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-foreground transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
        );
        if (t.functional) {
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              {t.label}
              {underline}
            </a>
          );
        }
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toast.info(`${t.label} — coming soon`)}
            className={className}
          >
            {t.label}
            {underline}
          </button>
        );
      })}
    </nav>
  );
}
