"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { AllocationSlice } from "@/lib/portfolio/calc";
import { formatINR, formatPercent } from "@/lib/utils";

const COLORS = [
  "hsl(var(--chart-1, 221 83% 53%))",
  "hsl(var(--chart-2, 142 71% 45%))",
  "hsl(var(--chart-3, 47 96% 53%))",
  "hsl(var(--chart-4, 0 84% 60%))",
  "hsl(var(--chart-5, 280 65% 60%))",
  "hsl(var(--chart-6, 173 80% 40%))",
  "hsl(var(--chart-7, 25 95% 53%))",
  "hsl(var(--chart-8, 199 89% 48%))",
];

export function AllocationChart({ data }: { data: AllocationSlice[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No holdings to display.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="symbol"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={1}
              stroke="hsl(var(--background))"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value: number, _name, item) => [
                `${formatINR(value)} (${formatPercent(item.payload.pct)})`,
                item.payload.symbol,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 self-center text-sm">
        {data.slice(0, 8).map((slice, i) => (
          <li
            key={`${slice.exchange}:${slice.symbol}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="truncate font-medium">{slice.symbol}</span>
              <span className="text-xs text-muted-foreground">
                {slice.exchange}
              </span>
            </span>
            <span className="num shrink-0 tabular-nums text-muted-foreground">
              {formatPercent(slice.pct)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
