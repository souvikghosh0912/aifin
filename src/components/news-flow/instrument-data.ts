import type { Exchange } from "@/types/database";

/**
 * Static seed of "recent instruments" surfaced in the instrument
 * popover and the Select-instruments modal. Mirrors the items shown in
 * instrumentmodal.png so the picker is recognisable on first paint.
 * The popover/modal also lets the user search the real /api/search
 * endpoint, so this list is only a starting point.
 */
export interface Instrument {
  symbol: string;
  name: string;
  /** "NSE" / "NSEIX" / "OANDA" / "Bitstamp" — shown in the right column. */
  venue: string;
  type: string;
  /** Tailwind background colour for the round symbol icon. */
  iconBg: string;
  /** Tailwind text colour for the symbol icon glyph. */
  iconFg?: string;
  /** Two-letter venue badge that sits next to the venue column. */
  venueFlag: string;
  /** Tailwind classes for the venue badge background. */
  venueFlagBg: string;
  /** Exchange enum, when this is a domestic equity (used for routing). */
  exchange?: Exchange;
}

export const RECENT_INSTRUMENTS: Instrument[] = [
  {
    symbol: "ITC",
    name: "ITC Limited",
    venue: "NSE",
    type: "stock",
    iconBg: "bg-sky-700",
    iconFg: "text-white",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
    exchange: "NSE",
  },
  {
    symbol: "WIPRO",
    name: "Wipro Limited",
    venue: "NSE",
    type: "stock",
    iconBg: "bg-violet-200",
    iconFg: "text-violet-800",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
    exchange: "NSE",
  },
  {
    symbol: "NIFTY1!",
    name: "GIFT NIFTY 50 INDEX FUTURES",
    venue: "NSEIX",
    type: "futures",
    iconBg: "bg-amber-200",
    iconFg: "text-amber-800",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
  },
  {
    symbol: "GRASIM",
    name: "Grasim Industries Ltd.",
    venue: "NSE",
    type: "stock",
    iconBg: "bg-stone-300",
    iconFg: "text-stone-800",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
    exchange: "NSE",
  },
  {
    symbol: "BALRAMCHIN",
    name: "Balrampur Chini Mills Ltd",
    venue: "NSE",
    type: "stock",
    iconBg: "bg-orange-500",
    iconFg: "text-white",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
    exchange: "NSE",
  },
  {
    symbol: "IRFC",
    name: "Indian Railway Finance Corp. Ltd.",
    venue: "NSE",
    type: "stock",
    iconBg: "bg-red-500",
    iconFg: "text-white",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
    exchange: "NSE",
  },
  {
    symbol: "NIFTY",
    name: "Nifty 50 Index",
    venue: "NSE",
    type: "index",
    iconBg: "bg-slate-800",
    iconFg: "text-white",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
  },
  {
    symbol: "XAUUSD",
    name: "Gold",
    venue: "OANDA",
    type: "commodity cfd",
    iconBg: "bg-amber-400",
    iconFg: "text-amber-900",
    venueFlag: "FX",
    venueFlagBg: "bg-slate-200 text-slate-700",
  },
  {
    symbol: "BANKNIFTY",
    name: "Nifty Bank Index",
    venue: "NSE",
    type: "index",
    iconBg: "bg-indigo-900",
    iconFg: "text-white",
    venueFlag: "IN",
    venueFlagBg: "bg-orange-100 text-orange-700",
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin / U.S. dollar",
    venue: "Bitstamp",
    type: "spot crypto defi",
    iconBg: "bg-orange-400",
    iconFg: "text-white",
    venueFlag: "BS",
    venueFlagBg: "bg-emerald-100 text-emerald-700",
  },
];
