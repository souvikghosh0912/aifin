"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * TradingView-style tab strip under the hero header. Each tab is an in-page
 * anchor that scrolls to a labelled section (`#overview`, `#key-stats`,
 * `#technicals`). Active state is driven by IntersectionObserver so the
 * underline tracks the user's scroll position.
 */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "key-stats", label: "Key stats" },
  { id: "technicals", label: "Technicals" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function StockTabs() {
  const [active, setActive] = useState<TabId>("overview");

  useEffect(() => {
    const sections = TABS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as TabId);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      className="-mx-0.5 flex items-center gap-1 overflow-x-auto border-b text-sm"
      aria-label="Stock page sections"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <a
            key={t.id}
            href={`#${t.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 py-2.5 font-medium text-muted-foreground transition-colors hover:text-foreground",
              isActive && "text-foreground",
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
          </a>
        );
      })}
    </nav>
  );
}
