import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const INR_COMPACT_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  return opts?.compact
    ? INR_COMPACT_FORMATTER.format(value)
    : INR_FORMATTER.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return PERCENT_FORMATTER.format(value / 100);
}

export function signed(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}
