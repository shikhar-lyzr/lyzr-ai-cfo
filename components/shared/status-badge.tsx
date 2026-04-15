import { clsx } from "clsx";

type BadgeStatus = "active" | "available" | "draft" | "error" | "running" | "pending";

const STATUS_STYLES: Record<BadgeStatus, string> = {
  active:    "bg-green-50 text-green-700 border-green-200",
  available: "bg-gray-50 text-gray-600 border-gray-200",
  draft:     "bg-amber-50 text-amber-700 border-amber-200",
  error:     "bg-red-50 text-red-700 border-red-200",
  running:   "bg-blue-50 text-blue-700 border-blue-200",
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_LABELS: Record<BadgeStatus, string> = {
  active: "Active", available: "Available", draft: "Draft",
  error: "Error", running: "Running", pending: "Pending",
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
      STATUS_STYLES[status]
    )}>
      <span className={clsx(
        "w-1.5 h-1.5 rounded-full",
        status === "active" ? "bg-green-500" :
        status === "running" ? "bg-blue-500" :
        status === "error" ? "bg-red-500" : "bg-gray-400"
      )} />
      {STATUS_LABELS[status]}
    </span>
  );
}
