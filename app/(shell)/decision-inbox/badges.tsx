import type { InboxRowKind, InboxSeverity } from "./inbox-row";

const KIND_META: Record<InboxRowKind, { label: string; classes: string }> = {
  post_journal:         { label: "Decision", classes: "bg-blue-100 text-blue-900" },
  variance:             { label: "Variance", classes: "bg-amber-100 text-amber-900" },
  anomaly:              { label: "Anomaly",  classes: "bg-rose-100 text-rose-900" },
  recommendation:       { label: "Rec",      classes: "bg-violet-100 text-violet-900" },
  ar_followup:          { label: "AR",       classes: "bg-emerald-100 text-emerald-900" },
  reconciliation_break: { label: "Recon",    classes: "bg-orange-100 text-orange-900" },
};

const SEVERITY_META: Record<InboxSeverity, { label: string; classes: string }> = {
  high:   { label: "High",   classes: "bg-red-600 text-white" },
  medium: { label: "Medium", classes: "bg-amber-500 text-white" },
  low:    { label: "Low",    classes: "bg-gray-300 text-gray-800" },
};

const PILL_BASE = "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide";

export function KindChip({ kind }: { kind: InboxRowKind }) {
  const m = KIND_META[kind];
  return <span className={`${PILL_BASE} ${m.classes}`}>{m.label}</span>;
}

export function SeverityBadge({ severity }: { severity: InboxSeverity }) {
  const m = SEVERITY_META[severity];
  return <span className={`${PILL_BASE} ${m.classes}`}>{m.label}</span>;
}
