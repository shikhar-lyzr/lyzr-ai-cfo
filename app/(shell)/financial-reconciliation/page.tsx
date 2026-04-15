import { RefreshCw } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { MetricCard } from "@/components/shared/metric-card";
import { RECON_METRICS, RECON_EXCEPTIONS } from "@/lib/config/journey-sample-data";

export default function FinancialReconciliationPage() {
  return (
    <JourneyPage
      id="financial-reconciliation"
      title="Financial Reconciliation"
      description="GL vs sub-ledger matching, break identification & ageing analysis"
      icon={RefreshCw}
      nudges={["Show unmatched items", "Why is the match rate low?", "Classify exceptions"]}
    >
      <div className="grid grid-cols-4 gap-4 mb-8">
        {RECON_METRICS.map((m) => (
          <MetricCard key={m.label} value={m.value} label={m.label} sublabel={m.sublabel} />
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>
        Top Exceptions
      </h3>
      <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ref</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Age</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {RECON_EXCEPTIONS.map((ex) => (
              <tr key={ex.ref} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 py-2.5 font-mono text-xs">{ex.ref}</td>
                <td className="px-4 py-2.5 font-semibold">{ex.amount}</td>
                <td className="px-4 py-2.5">{ex.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{ex.age}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{ex.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JourneyPage>
  );
}
