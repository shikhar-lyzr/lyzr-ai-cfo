import { clsx } from "clsx";

type Verdict = "pass" | "flagged" | "warning";

const VERDICT_STYLES: Record<Verdict, string> = {
  pass:    "bg-green-100 text-green-800",
  flagged: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "PASS", flagged: "FLAGGED", warning: "WARNING",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={clsx(
      "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
      VERDICT_STYLES[verdict]
    )}>
      {VERDICT_LABELS[verdict]}
    </span>
  );
}
