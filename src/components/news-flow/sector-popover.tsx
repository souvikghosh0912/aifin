"use client";

import { ChevronDown, RotateCcw } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CheckBox } from "./check-box";
import { SECTORS, type SectorId } from "./sector-data";

interface Props {
  value: Set<SectorId>;
  onChange: (next: Set<SectorId>) => void;
}

/**
 * Multi-select popover for the News Flow Sector filter. Mirrors
 * FormatPopover's chrome: Reset button in the header, Select-all
 * toggle row, then a checklist. Empty value renders the default chip
 * label; a non-empty value renders "Sector: N".
 */
export function SectorPopover({ value, onChange }: Props) {
  const active = value.size > 0;
  const allOn = value.size === SECTORS.length;

  const toggle = (id: SectorId) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const reset = () => onChange(new Set());
  const toggleAll = () => {
    if (allOn) onChange(new Set());
    else onChange(new Set(SECTORS.map((s) => s.id)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-sm border border-border px-2 text-[12px] font-medium hover:bg-accent",
            active
              ? "bg-accent text-foreground"
              : "bg-background text-foreground/80 hover:text-foreground",
          )}
          aria-label="Filter by sector"
        >
          <span>Sector{active ? `: ${value.size}` : ""}</span>
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sector
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            <span>Reset</span>
          </button>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="flex w-full items-center gap-2 border-y px-3 py-2 text-[13px] font-medium text-foreground hover:bg-accent/60"
        >
          <CheckBox checked={allOn} />
          <span>Select all</span>
        </button>
        <ul className="max-h-[280px] overflow-y-auto py-1">
          {SECTORS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-accent/60"
              >
                <CheckBox checked={value.has(s.id)} />
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
