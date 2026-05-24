"use client";

import { usePathname } from "next/navigation";

import { MarketsSearchTrigger } from "@/components/markets/markets-search-trigger";

/**
 * Renders the markets search trigger in the global app header — but only
 * when the user is on the /markets route. Keeps the header chrome quiet
 * elsewhere and avoids stealing Cmd/Ctrl+K from the sidebar FindBar on
 * other pages.
 */
export function HeaderSearchSlot() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/markets")) return null;
  return <MarketsSearchTrigger />;
}
