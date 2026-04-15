import { FileText } from "lucide-react";
import { JourneyPage } from "@/components/journey/journey-page";
import { StatusBadge } from "@/components/shared/status-badge";
import { FILING_STATUS } from "@/lib/config/journey-sample-data";

const STATUS_MAP = { draft: "draft" as const, submitted: "running" as const, validated: "active" as const };

export default function RegulatoryReturnsPage() {
  return (
    <JourneyPage
      id="regulatory-returns"
      title="Regulatory Returns"
      description="COREP, FINREP, FR Y-9C filing preparation & validation"
      icon={FileText}
      nudges={["Filing status?", "What's blocking COREP?", "Validate FR Y-9C"]}
    >
      <div className="bg-card border border-border rounded-[var(--radius)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Filing</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Due Date</th>
              <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Completion</th>
            </tr>
          </thead>
          <tbody>
            {FILING_STATUS.map((f) => (
              <tr key={f.name} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="px-4 py-3"><StatusBadge status={STATUS_MAP[f.status]} /></td>
                <td className="px-4 py-3 text-muted-foreground">{f.due}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-border/50 rounded-full h-2">
                      <div className="bg-primary rounded-full h-2" style={{ width: `${f.completion}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{f.completion}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </JourneyPage>
  );
}
