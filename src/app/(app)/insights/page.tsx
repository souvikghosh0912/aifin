import { CalendarDays, LineChart, Sparkles } from "lucide-react";

import { AiStubBanner } from "@/components/ai/ai-stub-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REPORT_CARDS = [
  {
    icon: CalendarDays,
    kind: "Weekly",
    title: "Weekly portfolio digest",
    description:
      "Every Monday: top movers, dividends, corporate actions, and notable concentration shifts from the week.",
  },
  {
    icon: Sparkles,
    kind: "Monthly",
    title: "Monthly performance review",
    description:
      "End-of-month writeup comparing your portfolio against Nifty 50 and Sensex, with attribution analysis.",
  },
  {
    icon: LineChart,
    kind: "Forecast",
    title: "Forward-looking forecast",
    description:
      "Trend analysis on individual holdings, with scenario modeling and risk callouts.",
  },
];

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("ai_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          AI-generated reports about your portfolio.
        </p>
      </div>

      <AiStubBanner
        title="Reports run on a schedule"
        description="Once an AI provider is configured, reports are generated automatically on a weekly/monthly cadence and stored here."
      />

      {reports && reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="capitalize">{r.kind} report</CardTitle>
                <CardDescription>
                  {new Date(r.period_start).toLocaleDateString()} —{" "}
                  {new Date(r.period_end).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                {r.content}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {REPORT_CARDS.map((c) => (
            <Card key={c.title} className="opacity-70">
              <CardHeader>
                <c.icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="mt-2 text-base">{c.title}</CardTitle>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
