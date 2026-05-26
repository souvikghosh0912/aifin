import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Square checkbox visual used by every filter popover in the News Flow
 * filter bar (Format, Sector, Provider). Purely presentational — the
 * caller owns the toggle state and click handler.
 */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded-sm border",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background",
      )}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}
