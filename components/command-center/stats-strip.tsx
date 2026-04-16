"use client";

import { useEffect, useState } from "react";
import { DonutChart, type DonutSlice } from "@/components/shared/donut-chart";

interface Stats {
  actions: { critical: number; warning: number; info: number; total: number } | null;
  ar: { info: number; warning: number; critical: number; total: number } | null;
  topCategories: Array<{ category: string; variance: number; direction: "over" | "under" }>;
}

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setStats(data);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!stats) {
    return (
      <div className="mb-6 bg-card border border-border rounded-[var(--radius)] p-4 h-[160px] animate-pulse" />
    );
  }

  const { actions, ar, topCategories } = stats;

  const severitySlices: DonutSlice[] = [
    { label: "Critical", value: actions?.critical ?? 0, color: "var(--destructive)" },
    { label: "Warning", value: actions?.warning ?? 0, color: "var(--warning, #f59e0b)" },
    { label: "Info", value: actions?.info ?? 0, color: "var(--muted-foreground)" },
  ];

  const arSlices: DonutSlice[] = ar
    ? [
        { label: "Current", value: ar.info, color: "var(--success, #10b981)" },
        { label: "1–30 days", value: ar.warning, color: "var(--warning, #f59e0b)" },
        { label: "30+ days", value: ar.critical, color: "var(--destructive)" },
      ]
    : [];

  return (
    <div className="mb-6 bg-card border border-border rounded-[var(--radius)] p-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Actions by severity
          </div>
          <DonutChart
            slices={severitySlices}
            centerValue={actions?.total ?? 0}
            centerLabel="total"
          />
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            AR Aging
          </div>
          {ar && ar.total > 0 ? (
            <DonutChart
              slices={arSlices}
              centerValue={ar.total}
              centerLabel="open"
            />
          ) : (
            <div className="text-sm text-muted-foreground">No open invoices</div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Top Variances
          </div>
          {topCategories?.length ? (
            <ul className="space-y-2">
              {topCategories.map((t) => (
                <li key={t.category} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{t.category}</span>
                  <span
                    className={
                      t.direction === "over"
                        ? "text-destructive tabular-nums"
                        : "text-success tabular-nums"
                    }
                  >
                    {t.direction === "over" ? "+" : "−"}
                    {formatCurrency(Math.abs(t.variance))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">No variance data</div>
          )}
        </div>
      </div>
    </div>
  );
}
