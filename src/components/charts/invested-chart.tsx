"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatINR } from "@/lib/utils";

export interface PnlPoint {
  date: string;
  invested: number;
}

export function InvestedChart({ data }: { data: PnlPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Need at least two transactions to chart capital deployed over time.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatINR(v, { compact: true })}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
            formatter={(v: number) => formatINR(v)}
          />
          <Area
            type="monotone"
            dataKey="invested"
            stroke="hsl(var(--chart-1))"
            fillOpacity={1}
            fill="url(#investGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
