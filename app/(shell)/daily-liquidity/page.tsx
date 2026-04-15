import { Droplets } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { LIQUIDITY_METRICS } from "@/lib/config/journey-sample-data";

export default function DailyLiquidityPage() {
  return (
    <JourneyPage
      id="daily-liquidity"
      title="Daily Liquidity"
      description="LCR, NSFR, cash flow forecasting & intraday position monitoring"
      icon={Droplets}
      nudges={["Current LCR?", "Cash forecast next 7 days", "Intraday stress"]}
    >
      <div className="grid grid-cols-3 gap-6">
        {LIQUIDITY_METRICS.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-[var(--radius)] p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{m.label}</div>
            <div className="text-3xl font-semibold mt-2" style={{ fontFamily: "var(--font-playfair)" }}>
              {m.value}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {m.minimum && <span className="text-xs text-muted-foreground">Min. required: {m.minimum}</span>}
              <span className={`text-xs font-medium ${m.delta.startsWith("+") ? "text-success" : "text-warning"}`}>
                {m.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </JourneyPage>
  );
}
