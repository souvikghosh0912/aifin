import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  LineChart,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Live NSE & BSE quotes",
    description:
      "Real-time prices, day P&L, and corporate actions for every Indian-listed equity.",
  },
  {
    icon: BarChart3,
    title: "Portfolio analytics",
    description:
      "Weighted average cost, XIRR, allocation breakdowns, and time-series charts.",
  },
  {
    icon: Bot,
    title: "Chat with your data",
    description:
      "Ask plain-English questions about your holdings, transactions, and performance.",
  },
  {
    icon: Sparkles,
    title: "AI-generated reports",
    description:
      "Weekly and monthly written summaries highlighting movers, risks, and opportunities.",
  },
  {
    icon: LineChart,
    title: "Forecasting",
    description:
      "Trend analysis and cash-flow projections grounded in your actual data.",
  },
  {
    icon: Shield,
    title: "Private & secure",
    description:
      "Per-user row-level security on every table. Your data never leaves your control.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              ₹
            </div>
            <span>finai</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-native portfolio analytics for Indian markets
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Your portfolio,{" "}
            <span className="text-foreground">understood</span>
            .
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground md:text-xl">
            Track NSE &amp; BSE holdings, log transactions, and let AI surface
            the signal in your portfolio. Built for serious Indian retail
            investors.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start tracking — it&apos;s free
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container pb-20">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="h-6 w-6 text-primary" />
                <CardTitle className="mt-2">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} finai</span>
          <span>
            Market data via{" "}
            <span className="font-medium text-foreground">nse-bse-api</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
