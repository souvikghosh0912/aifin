"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * Stock detail page tab strip + panel switcher.
 *
 * "Overview" and "News" are full panels — clicking swaps the entire content
 * area below the tabs. The pre-existing "Technicals" tab continues to act as
 * an anchor jump inside the overview panel (it lives there as a section).
 * All other tabs ship as visual stubs that toast a "coming soon" hint.
 *
 * Both panels are server-rendered up-front and toggled via the `hidden`
 * attribute so switching is instant — no re-fetch, no remount.
 */
interface TabDef {
  id: string;
  label: string;
  functional: boolean;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", functional: true },
  { id: "financials", label: "Financials", functional: false },
  { id: "news", label: "News", functional: true },
  { id: "ideas", label: "Ideas", functional: false },
  { id: "community", label: "Community", functional: false },
  { id: "technicals", label: "Technicals", functional: true },
  { id: "forecasts", label: "Forecasts", functional: false },
  { id: "seasonals", label: "Seasonals", functional: false },
  { id: "options", label: "Options", functional: false },
  { id: "bonds", label: "Bonds", functional: false },
  { id: "etfs", label: "ETFs", functional: false },
];

type Panel = "overview" | "news";

interface Props {
  overview: React.ReactNode;
  news: React.ReactNode;
}

export function StockTabs({ overview, news }: Props) {
  const [panel, setPanel] = useState<Panel>("overview");
  const [scrolledSection, setScrolledSection] = useState<string>("overview");
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  // Within the overview panel, an IntersectionObserver tracks which anchor
  // section is in view so the tab underline follows the user's scroll
  // (preserves the pre-existing Overview/Technicals indicator behaviour).
  useEffect(() => {
    if (panel !== "overview") {
      setScrolledSection("overview");
      return;
    }
    const sections = ["overview", "technicals"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setScrolledSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [panel]);

  // Switching to overview with a pending scroll target: defer scrollIntoView
  // until after the panel becomes visible. Hidden panels are display:none
  // and can't be scrolled to, so we wait one render.
  useEffect(() => {
    if (panel !== "overview" || !scrollTarget) return;
    const el = document.getElementById(scrollTarget);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTarget(null);
  }, [panel, scrollTarget]);

  const handleClick = useCallback((tab: TabDef) => {
    if (!tab.functional) {
      toast.info(`${tab.label} — coming soon`);
      return;
    }
    if (tab.id === "news") {
      setPanel("news");
      return;
    }
    setPanel("overview");
    setScrollTarget(tab.id);
  }, []);

  const activeId = panel === "news" ? "news" : scrolledSection;

  return (
    <>
      <nav
        className="-mx-0.5 flex items-center gap-0 overflow-x-auto border-b text-[13px]"
        aria-label="Stock page sections"
      >
        {TABS.map((t) => {
          const isActive = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleClick(t)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative shrink-0 px-3 py-2.5 font-normal text-muted-foreground transition-colors hover:text-foreground",
                isActive && "font-semibold text-foreground",
              )}
            >
              {t.label}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-foreground transition-opacity",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </nav>

      <div hidden={panel !== "overview"} className="space-y-4">
        {overview}
      </div>
      <div hidden={panel !== "news"} className="space-y-4">
        {news}
      </div>
    </>
  );
}
