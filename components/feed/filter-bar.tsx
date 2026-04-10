"use client";

import { clsx } from "clsx";
import type { ActionType, Severity, ActionStatus } from "@/lib/types";

interface FilterBarProps {
  activeType: ActionType | "all";
  activeSeverity: Severity | "all";
  activeStatus: ActionStatus | "all";
  onTypeChange: (type: ActionType | "all") => void;
  onSeverityChange: (severity: Severity | "all") => void;
  onStatusChange: (status: ActionStatus | "all") => void;
}

function FilterGroup({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-text-secondary font-medium">{label}:</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-2.5 py-1 text-xs rounded-btn transition-colors",
            active === opt.value
              ? "bg-accent-primary text-white"
              : "text-text-secondary hover:bg-border/40"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  activeType,
  activeSeverity,
  activeStatus,
  onTypeChange,
  onSeverityChange,
  onStatusChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-border bg-bg-card">
      <FilterGroup
        label="Type"
        options={[
          { value: "all", label: "All" },
          { value: "variance", label: "Variance" },
          { value: "anomaly", label: "Anomaly" },
          { value: "recommendation", label: "Rec." },
          { value: "ar_followup", label: "AR" },
        ]}
        active={activeType}
        onChange={(v) => onTypeChange(v as ActionType | "all")}
      />
      <FilterGroup
        label="Severity"
        options={[
          { value: "all", label: "All" },
          { value: "critical", label: "Critical" },
          { value: "warning", label: "Warning" },
          { value: "info", label: "Info" },
        ]}
        active={activeSeverity}
        onChange={(v) => onSeverityChange(v as Severity | "all")}
      />
      <FilterGroup
        label="Status"
        options={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "flagged", label: "Flagged" },
          { value: "dismissed", label: "Dismissed" },
        ]}
        active={activeStatus}
        onChange={(v) => onStatusChange(v as ActionStatus | "all")}
      />
    </div>
  );
}
