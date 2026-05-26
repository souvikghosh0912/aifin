"use client";

import { ChevronDown, X } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryId } from "@/lib/market/news";
import { cn } from "@/lib/utils";

import { FormatPopover } from "./format-popover";
import type { FormatState } from "./format-state";
import { InstrumentPopover } from "./instrument-popover";
import { ProviderPopover } from "./provider-popover";
import { SectorPopover } from "./sector-popover";
import type { SectorId } from "./sector-data";

interface Props {
  symbol: string;
  category: CategoryId;
  onCategoryChange: (next: CategoryId) => void;
  format: FormatState;
  onFormatChange: (next: FormatState) => void;
  sectors: Set<SectorId>;
  onSectorsChange: (next: Set<SectorId>) => void;
  providers: Set<string>;
  providerOptions: string[];
  onProvidersChange: (next: Set<string>) => void;
  /** Resets every wired filter — category, format, sector, provider —
   *  back to defaults. */
  onResetAll: () => void;
  disabled?: boolean;
}

const CATEGORY_OPTIONS: { id: CategoryId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "key-facts", label: "Key facts" },
  { id: "earnings", label: "Earnings" },
  { id: "earnings-calls", label: "Earnings calls" },
  { id: "dividends", label: "Dividends" },
  { id: "strategy", label: "Strategy, business, and management" },
  { id: "mergers", label: "Mergers and acquisitions" },
  { id: "management", label: "Management" },
  { id: "esg", label: "ESG and regulation" },
  { id: "analysts", label: "Analysts" },
];

/**
 * Multi-row filter bar matching newsflow.png: every field is a
 * bordered dropdown button. Corporate activity, Format, Sector,
 * Provider, and the instrument chip are wired to real state; the
 * remaining slots (Watchlists, Save, Economics, Country) are visual
 * stubs because the page doesn't yet have data sources behind them.
 * "Reset all" clears every wired filter.
 */
export function NewsFlowFilterBar({
  symbol,
  category,
  onCategoryChange,
  format,
  onFormatChange,
  sectors,
  onSectorsChange,
  providers,
  providerOptions,
  onProvidersChange,
  onResetAll,
  disabled = false,
}: Props) {
  const activeLabel =
    CATEGORY_OPTIONS.find((o) => o.id === category)?.label ?? "All";

  return (
    <div className="space-y-2 border-y py-3 text-[13px]">
      <FilterRow>
        <DropdownStub label="Watchlists" />
        <InstrumentPopover activeSymbol={symbol} />
        <DropdownStub label="Save" />
        <SectorPopover value={sectors} onChange={onSectorsChange} />
      </FilterRow>

      <FilterRow>
        <Select
          value={category}
          onValueChange={(v) => onCategoryChange(v as CategoryId)}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-7 max-w-[200px] gap-1 rounded-sm border border-border bg-background px-2 py-0 text-[12px] font-medium text-foreground hover:bg-accent focus:ring-0 focus:ring-offset-0"
            aria-label="Filter by corporate activity"
          >
            <SelectValue>
              <span className="text-foreground/70">Corporate activity:</span>{" "}
              <span>{activeLabel}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="w-[220px] min-w-0">
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {category !== "all" ? (
          <button
            type="button"
            aria-label="Clear corporate-activity filter"
            onClick={() => onCategoryChange("all")}
            className="grid h-6 w-6 place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        ) : null}
        <DropdownStub label="Economics" />
        <DropdownStub label="Country" />
        <ProviderPopover
          options={providerOptions}
          value={providers}
          onChange={onProvidersChange}
        />
      </FilterRow>

      <FilterRow>
        <FormatPopover value={format} onChange={onFormatChange} />
        <button
          type="button"
          onClick={onResetAll}
          className="ml-auto text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          Reset all
        </button>
      </FilterRow>
    </div>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  );
}

// Bordered dropdown trigger that matches the visual style of the
// real category Select. The labelled stubs don't have data backing yet
// — they render as clickable buttons so the bar reads as a grid of
// dropdowns rather than a mix of text + chips.
function DropdownStub({ label }: { label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-background px-2 text-[12px] font-medium text-foreground/80 hover:bg-accent hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <ChevronDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
