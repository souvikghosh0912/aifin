import Link from "next/link";
import { BarChart3, Bot, Shield, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const HIGHLIGHTS = [
  {
    icon: TrendingUp,
    title: "Live NSE & BSE quotes",
    description: "Real-time prices, day P&L, and corporate actions.",
  },
  {
    icon: BarChart3,
    title: "Portfolio analytics",
    description: "XIRR, weighted average cost, and allocation breakdowns.",
  },
  {
    icon: Bot,
    title: "Chat with your data",
    description: "Ask plain-English questions about your holdings.",
  },
  {
    icon: Shield,
    title: "Private & secure",
    description: "Per-user row-level security on every table.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex h-12 items-center justify-between border-b px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
              ₹
            </div>
            <span>finai</span>
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-8 lg:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside className="relative hidden flex-col border-l lg:flex">
        <header className="flex h-12 items-center justify-between border-b px-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-foreground" />
            AI-native portfolio analytics
          </div>
          <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            NSE & BSE
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-5 px-6 py-10 lg:px-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What&apos;s inside
          </h2>

          <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }, i) => (
              <div
                key={title}
                className={cn(
                  "flex flex-col gap-2 p-4",
                  i % 2 === 0 && "border-r",
                  i < 2 && "border-b",
                )}
              >
                <div className="grid h-7 w-7 place-items-center rounded-md bg-muted text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="flex h-12 items-center justify-between border-t px-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} finai</span>
          <span>
            Market data via{" "}
            <span className="font-medium text-foreground">nse-bse-api</span>
          </span>
        </footer>
      </aside>
    </div>
  );
}
