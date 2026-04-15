import { Landmark } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { CAPITAL_RATIOS } from "@/lib/config/journey-sample-data";

export default function RegulatoryCapitalPage() {
  return (
    <JourneyPage
      id="regulatory-capital"
      title="Regulatory Capital"
      description="CET1, RWA, leverage ratios & Basel III compliance assessment"
      icon={Landmark}
      nudges={["Are we above minimums?", "What drives RWA?", "CET1 trend"]}
    >
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">All above minimum</span>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {CAPITAL_RATIOS.map((ratio) => (
          <div key={ratio.label} className="bg-card border border-border rounded-[var(--radius)] p-6 text-center">
            <div className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
              {ratio.value}
            </div>
            <div className="text-sm font-medium text-foreground mt-1">{ratio.label}</div>
            <div className="text-xs text-muted-foreground mt-2">Min. required: {ratio.minimum}</div>
            <div className="w-full bg-border/50 rounded-full h-2 mt-3">
              <div
                className="bg-success rounded-full h-2"
                style={{ width: `${Math.min((parseFloat(ratio.value) / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}
