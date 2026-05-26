import { cn } from "@/lib/utils";

import type { Instrument } from "./instrument-data";

interface Props {
  instrument: Instrument;
  size?: "sm" | "md";
}

/**
 * Round glyph used in both the instrument popover row and the modal
 * list. The image references show vendor logos (ITC anchor, WIPRO mark,
 * Bitcoin ₿, …); we approximate with a colour-coded disc holding the
 * symbol's first character. Close enough at the sizes the list renders.
 */
export function InstrumentIcon({ instrument, size = "md" }: Props) {
  const ch = instrument.symbol.charAt(0);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        instrument.iconBg,
        instrument.iconFg ?? "text-foreground",
        size === "sm" ? "h-6 w-6 text-[11px]" : "h-9 w-9 text-[13px]",
      )}
    >
      {ch}
    </span>
  );
}

interface VenueFlagProps {
  instrument: Instrument;
  size?: "sm" | "md";
}

/**
 * Tiny two-letter chip that sits to the right of the venue label in
 * the modal — stands in for the country flag / vendor icon column.
 */
export function VenueFlag({ instrument, size = "md" }: VenueFlagProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        instrument.venueFlagBg,
        size === "sm" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]",
      )}
    >
      {instrument.venueFlag}
    </span>
  );
}
