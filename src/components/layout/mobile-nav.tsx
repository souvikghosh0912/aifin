"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Eye,
  MessageSquare,
  Receipt,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: BarChart3 },
  { href: "/holdings", label: "Holdings", icon: Briefcase },
  { href: "/transactions", label: "Txns", icon: Receipt },
  { href: "/markets", label: "Markets", icon: Search },
  { href: "/chat", label: "Chat", icon: MessageSquare },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background md:hidden">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium uppercase tracking-wider",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
