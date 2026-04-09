import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffHr < 1) return `${diffMin}m ago`;
  if (diffDay < 1) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount}`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-danger/10 text-danger border-danger/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/20";
    case "info":
      return "bg-success/10 text-success border-success/20";
    default:
      return "bg-border/10 text-text-secondary border-border";
  }
}

export function severityIcon(severity: string): string {
  switch (severity) {
    case "critical":
      return "AlertTriangle";
    case "warning":
      return "AlertCircle";
    case "info":
      return "CheckCircle";
    default:
      return "Info";
  }
}
