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

// Postgres `numeric` columns arrive as strings from supabase-js; accept those
// here too so direct `formatINR(row.something)` calls don't render as "—".
type Numeric = number | string | null | undefined;

function toNum(v: Numeric): number {
  if (v == null) return NaN;
  return typeof v === "number" ? v : Number(v);
}

export function formatINR(value: Numeric, opts?: { compact?: boolean }): string {
  const n = toNum(value);
  if (!Number.isFinite(n)) return "—";
  return opts?.compact
    ? INR_COMPACT_FORMATTER.format(n)
    : INR_FORMATTER.format(n);
}

export function formatNumber(value: Numeric): string {
  const n = toNum(value);
  if (!Number.isFinite(n)) return "—";
  return NUMBER_FORMATTER.format(n);
}

export function formatPercent(value: Numeric): string {
  const n = toNum(value);
  if (!Number.isFinite(n)) return "—";
  return PERCENT_FORMATTER.format(n / 100);
}

export function signed(value: Numeric): string {
  const n = toNum(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}
