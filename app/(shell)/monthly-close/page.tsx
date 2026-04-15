import { Calendar, CheckCircle } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { MONTHLY_CLOSE_STEPS, MONTHLY_CLOSE_BLOCKERS } from "@/lib/config/journey-sample-data";

export default function MonthlyClosePage() {
  const totalCompleted = MONTHLY_CLOSE_STEPS.reduce((acc, s) => acc + s.completed, 0);
  const totalItems = MONTHLY_CLOSE_STEPS.reduce((acc, s) => acc + s.total, 0);
  const pct = Math.round((totalCompleted / totalItems) * 100);

  return (
    <JourneyPage
      id="monthly-close"
      title="Monthly Close"
      description="Consolidation, trial balances, sub-ledger postings & close calendar"
      icon={Calendar}
      nudges={["Are we on track for close?", "What's still open?", "Draft board commentary"]}
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Monthly Close — Day 3 of 5
        </span>
        <span className="text-sm text-muted-foreground">{pct}% complete</span>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-8">
        {MONTHLY_CLOSE_STEPS.map((step) => {
          const done = step.completed === step.total;
          const inProgress = step.completed > 0 && !done;
          return (
            <div
              key={step.name}
              className={`bg-card border rounded-[var(--radius)] p-4 text-center ${
                done ? "border-success/30" : inProgress ? "border-warning/30" : "border-border"
              }`}
            >
              <div className="text-xs text-muted-foreground mb-1">{step.name}</div>
              <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
                {step.completed}/{step.total}
              </div>
              {done && <CheckCircle size={14} className="mx-auto mt-1 text-success" />}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
          Blocking Items
        </h3>
        <div className="space-y-2">
          {MONTHLY_CLOSE_BLOCKERS.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground bg-card border border-border rounded-[var(--radius)] px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </JourneyPage>
  );
}
