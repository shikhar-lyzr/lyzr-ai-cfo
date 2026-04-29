"use client";

import {
  KIND_OPTIONS,
  SEVERITY_OPTIONS,
  AGE_OPTIONS,
  type Filters,
  type KindFilter,
  type SeverityFilter,
  type AgeFilter,
} from "./inbox-filters";

function FilterGroup<T extends string>({
  label, options, active, onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
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
          className={
            "px-2.5 py-1 text-xs rounded transition-colors border " +
            (active === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground border-border hover:bg-secondary/50")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function InboxFilterBar({
  filters, onChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 border border-border rounded-lg bg-card/50">
      <FilterGroup<KindFilter>
        label="Kind"
        options={KIND_OPTIONS}
        active={filters.kind}
        onChange={(v) => onChange({ ...filters, kind: v })}
      />
      <FilterGroup<SeverityFilter>
        label="Severity"
        options={SEVERITY_OPTIONS}
        active={filters.severity}
        onChange={(v) => onChange({ ...filters, severity: v })}
      />
      <FilterGroup<AgeFilter>
        label="Age"
        options={AGE_OPTIONS}
        active={filters.age}
        onChange={(v) => onChange({ ...filters, age: v })}
      />
    </div>
  );
}
