"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { StatsData } from "@/lib/types";

interface StatsStripProps {
  stats: StatsData;
}

function StatBlock({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</span>
    </div>
  );
}

export function StatsStrip({ stats }: StatsStripProps) {
  const { actions, ar, topCategories } = stats;

  return (
    <div className="flex items-center gap-6 px-4 py-3 border-b border-border shrink-0 overflow-x-auto">
      {/* Action counts */}
      <div className="flex items-center gap-4 shrink-0">
        <StatBlock value={actions.critical} label="Critical" color="text-danger" />
        <StatBlock value={actions.warning} label="Warning" color="text-warning" />
        <StatBlock value={actions.info} label="Info" color="text-success" />
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-border shrink-0" />

      {/* AR aging donut */}
      {ar && ar.total > 0 && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="relative w-12 h-12 rounded-full shrink-0"
              style={{
                background: (() => {
                  const total = ar.total || 1;
                  const infoPct = (ar.info / total) * 100;
                  const warnPct = (ar.warning / total) * 100;
                  return `conic-gradient(var(--success) 0% ${infoPct}%, var(--warning) ${infoPct}% ${infoPct + warnPct}%, var(--danger) ${infoPct + warnPct}% 100%)`;
                })(),
              }}
            >
              <div className="absolute inset-[6px] bg-bg-card rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-text-primary">{ar.total}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-text-secondary">AR Aging</span>
              <span className="text-[10px] text-text-secondary">
                {ar.critical} overdue
              </span>
            </div>
          </div>
          <div className="w-px h-8 bg-border shrink-0" />
        </>
      )}

      {/* Top variances */}
      {topCategories.length > 0 && (
        <div className="flex flex-col gap-1 min-w-0">
          {topCategories.map((cat) => {
            const maxVariance = Math.max(...topCategories.map((c) => Math.abs(c.variance)));
            const barWidth = maxVariance > 0 ? Math.round((Math.abs(cat.variance) / maxVariance) * 80) : 0;
            const Icon = cat.direction === "over" ? TrendingUp : TrendingDown;
            const color = cat.direction === "over" ? "text-danger" : "text-success";

            return (
              <div key={cat.category} className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary w-16 truncate shrink-0">{cat.category}</span>
                <div
                  className={`h-1.5 rounded-full shrink-0 ${cat.direction === "over" ? "bg-danger/40" : "bg-success/40"}`}
                  style={{ width: `${barWidth}px` }}
                />
                <Icon className={`w-3 h-3 shrink-0 ${color}`} />
                <span className={`text-[10px] font-medium ${color}`}>
                  ${Math.abs(cat.variance).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
