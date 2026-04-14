"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import { SAMPLE_INSIGHTS, type Insight } from "@/lib/config/sample-insights";

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR = {
  critical: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

function InsightCard({ insight }: { insight: Insight }) {
  const router = useRouter();
  const Icon = SEVERITY_ICON[insight.severity];

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-b-0">
      <Icon size={18} className={`shrink-0 mt-0.5 ${SEVERITY_COLOR[insight.severity]}`} />
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-foreground">{insight.title}</h4>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{insight.detail}</p>
        {insight.cta && (
          <button
            onClick={() => router.push(insight.cta!.path)}
            className="text-xs font-medium text-primary hover:underline mt-1.5"
          >
            {insight.cta.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentInsights() {
  return (
    <div>
      <SectionHeader title="Agent Insights" count={SAMPLE_INSIGHTS.length} />
      <div className="mt-3 bg-card border border-border rounded-[var(--radius)] px-4 py-1">
        {SAMPLE_INSIGHTS.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
