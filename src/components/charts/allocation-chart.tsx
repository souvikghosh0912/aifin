"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatINR } from "@/lib/utils";
import type { AllocationSlice } from "@/lib/portfolio/calc";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function AllocationChart({ data }: { data: AllocationSlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No allocation data yet.
      </div>
    );
  }
  const top = data.slice(0, 8);
  const rest = data.slice(8);
  const slices =
    rest.length > 0
      ? [
          ...top,
          {
            symbol: "Others",
            exchange: "NSE" as const,
            value: rest.reduce((s, x) => s + x.value, 0),
            pct: rest.reduce((s, x) => s + x.pct, 0),
          },
        ]
      : top;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="symbol"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
            formatter={(value: number, _name, item) => [
              `${formatINR(value)} (${item.payload.pct.toFixed(1)}%)`,
              item.payload.symbol,
            ]}
          />
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
