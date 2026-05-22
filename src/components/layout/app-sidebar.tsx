"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FindBar } from "@/components/layout/find-bar";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden border-r bg-card/50 md:flex md:w-52 md:flex-col">
      <div className="flex h-12 items-center gap-2 border-b px-4 text-sm font-bold">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
          ₹
        </div>
        <span>finai</span>
      </div>
      <FindBar />
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/50 text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r before:bg-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <span className="flex items-center gap-2.5">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.badge ? (
                <span className="rounded bg-chart-4/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-chart-4">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
