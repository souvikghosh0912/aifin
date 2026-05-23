import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/market/types";

interface Props {
  value: Signal | null;
}

const TINT: Record<Signal, string> = {
  BUY: "bg-success/15 text-success",
  SELL: "bg-destructive/15 text-destructive",
  NEUTRAL: "bg-muted text-muted-foreground",
};

export function SignalBadge({ value }: Props) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TINT[value],
      )}
    >
      {value}
    </span>
  );
}
