"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { BudgetChartData } from "@/lib/types";

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value}`;
}

export function BudgetChart() {
  const [data, setData] = useState<BudgetChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chart/budget-vs-actual")
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-4 flex items-center justify-center h-[280px]">
        <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-4 flex items-center justify-center h-[280px]">
        <p className="text-sm text-text-secondary">No financial data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Budget vs Actual</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            width={50}
          />
          <Tooltip
            formatter={(value, name) => [
              `$${Number(value ?? 0).toLocaleString()}`,
              typeof name === "string" ? name.charAt(0).toUpperCase() + name.slice(1) : String(name),
            ]}
            contentStyle={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />
          <Bar dataKey="budget" fill="var(--border)" radius={[3, 3, 0, 0]} name="Budget" />
          <Bar dataKey="actual" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} name="Actual" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
