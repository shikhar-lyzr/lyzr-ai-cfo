import { clsx } from "clsx";

type Priority = "critical" | "high" | "medium" | "low";

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-red-100 text-red-800",
  high:     "bg-amber-100 text-amber-800",
  medium:   "bg-stone-100 text-stone-700",
  low:      "bg-gray-100 text-gray-600",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={clsx(
      "inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
      PRIORITY_STYLES[priority]
    )}>
      {priority}
    </span>
  );
}
