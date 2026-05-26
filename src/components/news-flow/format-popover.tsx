"use client";

import { ChevronDown, RotateCcw, Zap } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CheckBox } from "./check-box";
import {
  FORMAT_EMPTY,
  FORMAT_KEYS,
  areAllFormatsActive,
  isAnyFormatActive,
  type FormatKey,
  type FormatState,
} from "./format-state";

interface Props {
  value: FormatState;
  onChange: (next: FormatState) => void;
}

const LABELS: Record<FormatKey, string> = {
  flash: "Flash",
  important: "Important",
  keyFacts: "Key facts",
};

/**
 * Bordered dropdown that sits in the third row of the news-flow
 * filter bar. Opens a checklist with a Reset button next to the
 * header and a Select-all toggle below it.
 */
export function FormatPopover({ value, onChange }: Props) {
  const active = isAnyFormatActive(value);
  const allOn = areAllFormatsActive(value);

  const toggle = (k: FormatKey) => {
    onChange({ ...value, [k]: !value[k] });
  };
  const reset = () => onChange(FORMAT_EMPTY);
  const toggleAll = () => {
    if (allOn) {
      onChange(FORMAT_EMPTY);
    } else {
      onChange({ flash: true, important: true, keyFacts: true });
    }
  };

  const summary = summariseActive(value);

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
          aria-label="Filter by format"
        >
          <span>Format{summary ? `: ${summary}` : ""}</span>
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[240px] p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Format
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
        <ul className="py-1">
          {FORMAT_KEYS.map((k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => toggle(k)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-accent/60"
              >
                <CheckBox checked={value[k]} />
                <span className="flex items-center gap-1.5">
                  {k === "flash" ? (
                    <Zap
                      className="h-3.5 w-3.5 text-amber-500"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : null}
                  <span>{LABELS[k]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function summariseActive(f: FormatState): string {
  const parts: string[] = [];
  if (f.flash) parts.push("Flash");
  if (f.important) parts.push("Important");
  if (f.keyFacts) parts.push("Key facts");
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts.length}`;
}
