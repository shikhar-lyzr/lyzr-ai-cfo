import { BarChart3 } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { ECL_STAGES, ECL_MIGRATIONS } from "@/lib/config/journey-sample-data";

export default function Ifrs9EclPage() {
  return (
    <JourneyPage
      id="ifrs9-ecl"
      title="IFRS 9 ECL"
      description="Expected credit loss staging, PD/LGD models & macro overlays"
      icon={BarChart3}
      nudges={["Stage 2 migration drivers?", "Update PD models", "Macro overlay impact"]}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
        Stage Distribution
      </h3>
      <div className="space-y-3 mb-8">
        {ECL_STAGES.map((stage) => (
          <div key={stage.stage} className="bg-card border border-border rounded-[var(--radius)] px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{stage.stage}</div>
              <div className="text-xs text-muted-foreground">{stage.amount} ({stage.pct}%)</div>
            </div>
            <div className="w-48 bg-border/50 rounded-full h-2">
              <div className="bg-primary rounded-full h-2" style={{ width: `${stage.pct}%` }} />
            </div>
            <span className={`text-xs font-medium ${stage.delta.startsWith("+") ? "text-warning" : "text-success"}`}>
              {stage.delta}
            </span>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Stage Migration
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {ECL_MIGRATIONS.map((m) => (
          <div key={`${m.from}-${m.to}`} className="bg-card border border-border rounded-[var(--radius)] p-4">
            <div className="text-xs text-muted-foreground">{m.from} → {m.to}</div>
            <div className="text-lg font-semibold mt-1" style={{ fontFamily: "var(--font-playfair)" }}>{m.amount}</div>
            <div className="text-xs text-warning font-medium">{m.delta}</div>
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}
