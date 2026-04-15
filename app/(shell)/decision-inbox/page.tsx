"use client";

import { useState } from "react";
import { ChevronLeft, Shield } from "lucide-react";
import { SAMPLE_DECISIONS, type DecisionItem } from "@/lib/config/sample-observe-data";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { MetricCard } from "@/components/shared/metric-card";
import { DecisionTracingSvg } from "@/components/observe/decision-tracing-svg";

type FilterTab = "all" | "pending" | "approved" | "rejected";

export default function DecisionInboxPage() {
  const [selectedDecision, setSelectedDecision] = useState<DecisionItem | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const filteredDecisions = SAMPLE_DECISIONS.filter((d) => {
    if (filterTab === "all") return true;
    return d.status === filterTab;
  });

  const pendingCount = SAMPLE_DECISIONS.filter((d) => d.status === "pending").length;
  const criticalCount = SAMPLE_DECISIONS.filter(
    (d) => d.status === "pending" && d.priority === "critical"
  ).length;
  const approvedCount = SAMPLE_DECISIONS.filter((d) => d.status === "approved").length;
  const rejectedCount = SAMPLE_DECISIONS.filter((d) => d.status === "rejected").length;
  const flaggedCount = SAMPLE_DECISIONS.filter((d) => d.status === "flagged").length;

  const priorityBorderColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-red-500";
      case "high":
        return "border-amber-500";
      case "medium":
        return "border-blue-500";
      case "low":
        return "border-gray-500";
      default:
        return "border-gray-300";
    }
  };

  if (selectedDecision) {
    const allPass = selectedDecision.complianceChecks.every((c) => c.verdict === "pass");
    const outputStatus = allPass ? "Ready" : "Blocked";

    return (
      <div className="space-y-6">
        {/* Back link */}
        <button
          onClick={() => setSelectedDecision(null)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          Back to inbox
        </button>

        {/* Header with badges */}
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{selectedDecision.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <PriorityBadge priority={selectedDecision.priority} />
            <span className="text-xs text-muted-foreground">
              {selectedDecision.journey} • {selectedDecision.journeyStep}
            </span>
            <span className="text-xs text-muted-foreground">{selectedDecision.requestedAt}</span>
          </div>
        </div>

        {/* The Decision card */}
        <div className="border border-border rounded-lg p-6 bg-card space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            The Decision
          </h2>
          <p className="text-base leading-relaxed">{selectedDecision.what}</p>

          {(selectedDecision.amount || selectedDecision.entity || selectedDecision.triggeredBy) && (
            <div className="pt-4 border-t border-border grid grid-cols-3 gap-4 text-xs">
              {selectedDecision.amount && (
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">
                    Amount
                  </div>
                  <div className="font-semibold text-foreground">{selectedDecision.amount}</div>
                </div>
              )}
              {selectedDecision.entity && (
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">
                    Entity
                  </div>
                  <div className="font-semibold text-foreground">{selectedDecision.entity}</div>
                </div>
              )}
              {selectedDecision.triggeredBy && (
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">
                    Triggered By
                  </div>
                  <div className="font-semibold text-foreground">{selectedDecision.triggeredBy}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Supporting Evidence */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Supporting Evidence
          </h2>
          <ul className="space-y-2">
            {selectedDecision.evidence.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-foreground">
                <span className="text-muted-foreground">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Compliance Tracing Diagram */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-6">
            Compliance Tracing
          </h2>
          <DecisionTracingSvg
            checks={selectedDecision.complianceChecks}
            outputStatus={outputStatus}
          />
        </div>

        {/* Compliance Check Cards */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Compliance Checks
          </h2>
          <div className="space-y-3">
            {selectedDecision.complianceChecks.map((check) => (
              <div
                key={check.name}
                className="border border-border rounded-lg p-4 bg-card flex items-start gap-3"
              >
                <Shield
                  size={18}
                  className="mt-0.5 flex-shrink-0 text-muted-foreground"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{check.name}</span>
                    <VerdictBadgeCompat verdict={check.verdict} />
                  </div>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            disabled
            className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Approve
          </button>
          <button
            disabled
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
          <button
            disabled
            className="px-4 py-2 rounded-lg border border-border font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request Info
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1
            className="text-[28px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Decision Inbox
          </h1>
          <SampleDataBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          Agent recommendations awaiting human approval
        </p>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          value={pendingCount}
          label="Pending"
          sublabel={`${criticalCount} Critical`}
          sublabelColor="text-red-600"
        />
        <MetricCard value={approvedCount} label="Approved This Week" />
        <MetricCard value={rejectedCount} label="Rejected" />
        <MetricCard value={flaggedCount} label="Flagged by Compliance" />
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-8">
          {(
            [
              { key: "all" as FilterTab, label: "All" },
              {
                key: "pending" as FilterTab,
                label: `Pending (${SAMPLE_DECISIONS.filter((d) => d.status === "pending").length})`,
              },
              {
                key: "approved" as FilterTab,
                label: `Approved (${SAMPLE_DECISIONS.filter((d) => d.status === "approved").length})`,
              },
              {
                key: "rejected" as FilterTab,
                label: `Rejected (${SAMPLE_DECISIONS.filter((d) => d.status === "rejected").length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-1 py-3 text-sm font-medium transition-colors relative ${
                filterTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {filterTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Decision List */}
      <div className="space-y-4">
        {filteredDecisions.map((decision) => (
          <button
            key={decision.id}
            onClick={() => setSelectedDecision(decision)}
            className={`w-full text-left border-l-2 border-border rounded-lg p-4 bg-card hover:bg-accent transition-colors ${priorityBorderColor(
              decision.priority
            )}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base mb-1">{decision.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{decision.description}</p>

                {/* Metadata row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span>
                    {decision.journey} • {decision.journeyStep}
                  </span>
                  <span>•</span>
                  <span>{decision.agent}</span>
                  <span>•</span>
                  <span>{decision.requestedAt}</span>
                </div>

                {/* Badges */}
                <div className="flex gap-2">
                  <PriorityBadge priority={decision.priority} />
                  <StatusBadgeDecision status={decision.status} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function VerdictBadgeCompat({ verdict }: { verdict: "pass" | "fail" | "warning" }) {
  const verdictMap = {
    pass: "pass" as const,
    warning: "warning" as const,
    fail: "flagged" as const,
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        verdict === "pass"
          ? "bg-green-100 text-green-800"
          : verdict === "warning"
            ? "bg-amber-100 text-amber-800"
            : "bg-red-100 text-red-800"
      }`}
    >
      {verdict === "pass" ? "PASS" : verdict === "warning" ? "WARNING" : "FAIL"}
    </span>
  );
}

function StatusBadgeDecision({ status }: { status: string }) {
  const statusMap: Record<string, "pending" | "active" | "draft" | "running" | "error" | "available"> =
    {
      pending: "pending",
      approved: "active",
      rejected: "error",
      flagged: "draft",
    };

  const mappedStatus = statusMap[status] || "pending";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        mappedStatus === "active"
          ? "bg-green-50 text-green-700 border-green-200"
          : mappedStatus === "draft"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : mappedStatus === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          mappedStatus === "active"
            ? "bg-green-500"
            : mappedStatus === "error"
              ? "bg-red-500"
              : "bg-gray-400"
        }`}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
