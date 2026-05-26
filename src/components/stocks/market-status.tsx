"use client";

import { Minus } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Exchange } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  exchange: Exchange;
}

/* ---- IST market-hours math -------------------------------------------- */

const IST_OFFSET_MS = 5.5 * 60 * 60_000;
const PREOPEN_START = 9 * 60; // 09:00 IST
const REGULAR_START = 9 * 60 + 15; // 09:15 IST
const REGULAR_END = 15 * 60 + 30; // 15:30 IST
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

type MarketState = "pre-open" | "open" | "closed";

interface MarketStatus {
  state: MarketState;
  /** Milliseconds until pre-open begins; 0 once pre-open is reached. */
  msUntilPreOpen: number;
  /** IST minute-of-day (0–1440). */
  istMinuteOfDay: number;
  /** IST day-of-week (0 = Sunday). */
  istDayOfWeek: number;
}

function computeStatus(now: Date): MarketStatus {
  // Shift "now" into a frame where UTC clock-fields == IST clock-fields.
  const istShifted = new Date(now.getTime() + IST_OFFSET_MS);
  const istDayOfWeek = istShifted.getUTCDay();
  const istMinuteOfDay =
    istShifted.getUTCHours() * 60 + istShifted.getUTCMinutes();
  const isWeekend = istDayOfWeek === 0 || istDayOfWeek === 6;

  let state: MarketState = "closed";
  if (!isWeekend) {
    if (istMinuteOfDay >= PREOPEN_START && istMinuteOfDay < REGULAR_START) {
      state = "pre-open";
    } else if (
      istMinuteOfDay >= REGULAR_START &&
      istMinuteOfDay < REGULAR_END
    ) {
      state = "open";
    }
  }

  // Next pre-open: today if before 09:00 on a weekday; otherwise advance days
  // until we land on a weekday.
  let dayOffset = 0;
  if (isWeekend || istMinuteOfDay >= PREOPEN_START) {
    dayOffset = 1;
    while (true) {
      const candidate = (istDayOfWeek + dayOffset) % 7;
      if (candidate !== 0 && candidate !== 6) break;
      dayOffset++;
    }
  }
  const istMidnightShifted = new Date(istShifted);
  istMidnightShifted.setUTCHours(0, 0, 0, 0);
  const nextPreOpenUtc =
    istMidnightShifted.getTime() +
    dayOffset * 86_400_000 +
    PREOPEN_START * 60_000 -
    IST_OFFSET_MS;
  const msUntilPreOpen = Math.max(0, nextPreOpenUtc - now.getTime());

  return { state, msUntilPreOpen, istMinuteOfDay, istDayOfWeek };
}

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) {
    const dayWord = days === 1 ? "day" : "days";
    const hourWord = hours === 1 ? "hour" : "hours";
    return hours > 0
      ? `${days} ${dayWord} and ${hours} ${hourWord}`
      : `${days} ${dayWord}`;
  }
  const hourWord = hours === 1 ? "hour" : "hours";
  const minWord = mins === 1 ? "minute" : "minutes";
  if (hours > 0) return `${hours} ${hourWord} and ${mins} ${minWord}`;
  return `${mins} ${minWord}`;
}

/* ---- Component -------------------------------------------------------- */

export function MarketStatus({ exchange }: Props) {
  // Re-render once per minute so the duration / marker stay live while the
  // popover is mounted. The 1-second granularity isn't worth the renders.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const status = computeStatus(new Date());
  const closed = status.state === "closed";
  const stateLabel =
    status.state === "open"
      ? "Market open"
      : status.state === "pre-open"
        ? "Pre-market open"
        : "Market closed";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Market status"
          title={stateLabel}
          className="grid h-6 w-6 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[320px] p-4"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "grid h-6 w-6 place-items-center rounded border",
              closed
                ? "border-border bg-muted text-muted-foreground"
                : "border-success/40 bg-success/15 text-success",
            )}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-semibold text-foreground">
            {stateLabel}
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-foreground">
          {closed ? (
            <>
              Time for a walk &mdash; this market is closed. It&apos;ll open
              for pre-market trading in{" "}
              <span className="font-semibold">
                {formatDuration(status.msUntilPreOpen)}
              </span>
              .
            </>
          ) : status.state === "pre-open" ? (
            <>
              Pre-market is live. Regular trading begins shortly.
            </>
          ) : (
            <>
              Regular trading is live on {exchange}.
            </>
          )}
        </p>

        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {DAY_NAMES[status.istDayOfWeek]}
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
            <div
              aria-hidden
              style={{
                left: `${Math.min(100, Math.max(0, (status.istMinuteOfDay / 1440) * 100))}%`,
              }}
              className="absolute -top-1 h-3.5 w-px -translate-x-1/2 bg-foreground"
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>00:00</span>
            <span>24:00</span>
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Exchange timezone: Kolkata (UTC+5:30)
        </p>
      </PopoverContent>
    </Popover>
  );
}
