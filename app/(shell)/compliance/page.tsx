"use client";

import { useEffect, useState } from "react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { StatusBadge } from "@/components/shared/status-badge";

const SAMPLE_RULES_MUST_ALWAYS = [
  "Source every financial figure to its origin",
  "Flag any variance > 5%",
  "Apply materiality thresholds before recommending action",
  "Label estimates and assumptions explicitly",
];

const SAMPLE_RULES_MUST_NEVER = [
  "Fabricate or estimate numbers without labeling them",
  "Provide tax, legal, or investment advice",
  "Override compliance holds or approval gates",
  "Post journal entries without audit trail",
];

const SAMPLE_RULES_ESCALATION = [
  "Amounts > $1M require human approval",
  "Regulatory filings require CFO sign-off",
  "Board materials require dual review",
  "Novel scenarios require escalation",
];

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<"guardrails" | "frameworks" | "schedule">("guardrails");
  const [guardrails, setGuardrails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContext() {
      try {
        const res = await fetch("/api/agent/context");
        const data = await res.json();
        if (data.guardrails && data.guardrails.length > 0) {
          setGuardrails(data.guardrails);
        }
      } catch (error) {
        console.error("Failed to fetch guardrails:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchContext();
  }, []);

  const showSampleData = !loading && guardrails.length === 0;
  const displayGuardrails = guardrails.length > 0 ? guardrails : SAMPLE_RULES_MUST_ALWAYS;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-bold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
            Compliance & Guardrails
          </h1>
          {showSampleData && <SampleDataBadge />}
        </div>
        <p className="text-sm text-muted-foreground">Rules, frameworks, and validation schedules</p>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("guardrails")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "guardrails"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active Guardrails
        </button>
        <button
          onClick={() => setActiveTab("frameworks")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "frameworks"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Regulatory Frameworks
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "schedule"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Validation Schedule
        </button>
      </div>

      {/* Tab 1: Active Guardrails */}
      {activeTab === "guardrails" && (
        <div className="space-y-8">
          {/* Rules Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* MUST ALWAYS Card */}
            <div className="bg-card border-l-4 border-l-success border border-border rounded-[var(--radius)] p-5 space-y-4">
              <h3 className="text-base font-semibold text-foreground">MUST ALWAYS</h3>
              <ul className="space-y-3 text-sm text-foreground">
                {displayGuardrails.map((rule, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-success font-bold mt-0.5">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* MUST NEVER Card */}
            <div className="bg-card border-l-4 border-l-destructive border border-border rounded-[var(--radius)] p-5 space-y-4">
              <h3 className="text-base font-semibold text-foreground">MUST NEVER</h3>
              <ul className="space-y-3 text-sm text-foreground">
                {SAMPLE_RULES_MUST_NEVER.map((rule, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-destructive font-bold mt-0.5">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ESCALATION Card */}
            <div className="bg-card border-l-4 border-l-warning border border-border rounded-[var(--radius)] p-5 space-y-4">
              <h3 className="text-base font-semibold text-foreground">ESCALATION</h3>
              <ul className="space-y-3 text-sm text-foreground">
                {SAMPLE_RULES_ESCALATION.map((rule, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-warning font-bold mt-0.5">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Safety Check Statistics */}
          <div className="bg-card border border-border rounded-[var(--radius)] p-6">
            <h3 className="text-base font-semibold text-foreground mb-6">Safety Check Statistics</h3>
            <div className="grid grid-cols-3 gap-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Checks Run Today</p>
                <p className="text-4xl font-bold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
                  248
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Pass Rate</p>
                <p className="text-4xl font-bold text-success" style={{ fontFamily: "var(--font-playfair)" }}>
                  99.2%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Flagged for Review</p>
                <p className="text-4xl font-bold text-warning" style={{ fontFamily: "var(--font-playfair)" }}>
                  2
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Regulatory Frameworks */}
      {activeTab === "frameworks" && (
        <div className="space-y-4">
          {[
            { name: "SOX", lastValidated: "2026-03-15" },
            { name: "SEC", lastValidated: "2026-03-01" },
            { name: "GAAP / IFRS", lastValidated: "2026-03-15" },
          ].map((framework) => (
            <div
              key={framework.name}
              className="bg-card border border-border rounded-[var(--radius)] p-5 flex items-center justify-between"
            >
              <span className="text-sm font-medium text-foreground">{framework.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">
                  Last validated: {framework.lastValidated}
                </span>
                <StatusBadge status="active" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Validation Schedule */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {[
            { frequency: "Quarterly", description: "Internal controls testing", nextDate: "2026-06-30" },
            { frequency: "Monthly", description: "Regulatory capital validation", nextDate: "2026-04-30" },
            { frequency: "Weekly", description: "Threshold calibration review", nextDate: "2026-04-14" },
          ].map((item) => (
            <div
              key={item.frequency}
              className="bg-card border border-border rounded-[var(--radius)] p-5 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.frequency}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </div>
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                Next: {item.nextDate}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
