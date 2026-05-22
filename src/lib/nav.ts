import type { Route } from "next";
import {
  BarChart3,
  Briefcase,
  Eye,
  MessageSquare,
  Receipt,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/holdings", label: "Holdings", icon: Briefcase },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/markets", label: "Markets", icon: Search },
  { href: "/insights", label: "Insights", icon: Sparkles, badge: "AI" },
  { href: "/chat", label: "Chat", icon: MessageSquare, badge: "AI" },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
