"use client";

import { clsx } from "clsx";
import type { ActionType, Severity, ActionStatus } from "@/lib/types";

export type TypeFilter = ActionType | "all";
export type SeverityFilter = Severity | "all";
export type StatusFilter = ActionStatus | "all";

interface FilterBarProps {
  activeType: TypeFilter;
  activeSeverity: SeverityFilter;
  activeStatus: StatusFilter;
  onTypeChange: (type: TypeFilter) => void;
  onSeverityChange: (severity: SeverityFilter) => void;
  onStatusChange: (status: StatusFilter) => void;
}

function FilterGroup<T extends string>({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-2.5 py-1 text-xs rounded-[var(--radius)] transition-colors border",
            active === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground border-border hover:bg-secondary/50"
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 border-b border-border bg-card/50">
      <FilterGroup<TypeFilter>
        label="Type"
        options={[
          { value: "all", label: "All" },
          { value: "variance", label: "Variance" },
          { value: "anomaly", label: "Anomaly" },
          { value: "recommendation", label: "Rec" },
          { value: "ar_followup", label: "AR" },
        ]}
        active={activeType}
        onChange={onTypeChange}
      />
      <FilterGroup<SeverityFilter>
        label="Severity"
        options={[
          { value: "all", label: "All" },
          { value: "critical", label: "Critical" },
          { value: "warning", label: "Warning" },
          { value: "info", label: "Info" },
        ]}
        active={activeSeverity}
        onChange={onSeverityChange}
      />
      <FilterGroup<StatusFilter>
        label="Status"
        options={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "flagged", label: "Flagged" },
          { value: "approved", label: "Approved" },
          { value: "dismissed", label: "Dismissed" },
        ]}
        active={activeStatus}
        onChange={onStatusChange}
      />
    </div>
  );
}
