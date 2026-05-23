"use client";

import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function FullChartStub({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => toast.info("Full Chart — coming soon")}
      className={cn(
        "rounded border bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      Full Chart →
    </button>
  );
}
