"use client";

import { ChevronDown, RotateCcw } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CheckBox } from "./check-box";

interface Props {
  /** Sorted display names of publishers visible in the current items
   *  (after the Format filter, before Sector/Provider). */
  options: string[];
  /** Lowercased publisher keys currently selected. */
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}

/**
 * Multi-select popover for the News Flow Provider filter. The option
 * list is computed by the parent (NewsFlowShell) from the items
 * visible after the Format filter — that keeps the menu stable while
 * the user toggles Sector and prevents a selected publisher from
 * disappearing because of its own selection.
 */
export function ProviderPopover({ options, value, onChange }: Props) {
  const active = value.size > 0;
  const allOn = options.length > 0 && options.every((o) => value.has(key(o)));
  const empty = options.length === 0;

  const toggle = (display: string) => {
    const next = new Set(value);
    const k = key(display);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  const reset = () => onChange(new Set());
  const toggleAll = () => {
    if (empty) return;
    if (allOn) onChange(new Set());
    else onChange(new Set(options.map(key)));
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
          aria-label="Filter by provider"
        >
          <span>Provider{active ? `: ${value.size}` : ""}</span>
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Provider
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
          disabled={empty}
          className="flex w-full items-center gap-2 border-y px-3 py-2 text-[13px] font-medium text-foreground hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <CheckBox checked={allOn} />
          <span>Select all</span>
        </button>
        {empty ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            No providers in current view.
          </p>
        ) : (
          <ul className="max-h-[280px] overflow-y-auto py-1">
            {options.map((display) => (
              <li key={key(display)}>
                <button
                  type="button"
                  onClick={() => toggle(display)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-accent/60"
                >
                  <CheckBox checked={value.has(key(display))} />
                  <span className="truncate">{display}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function key(display: string): string {
  return display.trim().toLowerCase();
}
