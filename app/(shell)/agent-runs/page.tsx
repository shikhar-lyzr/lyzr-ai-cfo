"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { MetricCard } from "@/components/shared/metric-card";
import { ExecutionTracePanel } from "@/components/observe/execution-trace-panel";

const SAMPLE_RUNS = [
  {
    id: "a7f",
    journey: "Financial Reconciliation",
    agent: "CFO Office Agent",
    status: "done" as const,
    confidence: 0.94,
    duration: "47s",
    tokensIn: 12450,
    tokensOut: 3200,
    cost: "$0.048",
    safety: "clean" as const,
    input: "Reconcile March transactions...",
    output: "Match rate 94.85%. 223 exceptions flagged...",
    steps: [
      { label: "Load data", status: "ok" as const, duration: "4s" },
      { label: "Match transactions", status: "ok" as const, duration: "38s" },
      { label: "Flag exceptions", status: "ok" as const, duration: "5s" },
    ],
  },
  {
    id: "b2c",
    journey: "Monthly Close",
    agent: "Monthly Close Orchestrator",
    status: "live" as const,
    confidence: 0.91,
    duration: "—",
    tokensIn: 8421,
    tokensOut: 2188,
    cost: "$0.031",
    safety: "flag" as const,
    input: "Continue monthly close Day 3...",
    output: "In progress — step 4 consolidation...",
    steps: [
      { label: "Check prior steps", status: "ok" as const, duration: "2s" },
      { label: "Journal review", status: "warn" as const, duration: "12s" },
    ],
  },
  {
    id: "c4d",
    journey: "Accounts Payable",
    agent: "AP Automation Agent",
    status: "done" as const,
    confidence: 0.96,
    duration: "8.1s",
    tokensIn: 6234,
    tokensOut: 1847,
    cost: "$0.024",
    safety: "clean" as const,
    input: "Process today's invoices",
    output: "14 invoices processed. 2 duplicates flagged.",
    steps: [
      { label: "Invoice ingest", status: "ok" as const, duration: "3s" },
      { label: "Duplicate detection", status: "ok" as const, duration: "5s" },
    ],
  },
  {
    id: "d5e",
    journey: "Daily Liquidity",
    agent: "CFO Office Agent",
    status: "done" as const,
    confidence: 0.92,
    duration: "11.8s",
    tokensIn: 10156,
    tokensOut: 2847,
    cost: "$0.039",
    safety: "clean" as const,
    input: "Report LCR and NSFR",
    output: "LCR 141%, NSFR 118%.",
    steps: [{ label: "Query cash positions", status: "ok" as const, duration: "4s" }],
  },
  {
    id: "e6f",
    journey: "Regulatory Capital",
    agent: "CFO Office Agent",
    status: "fail" as const,
    confidence: 0.88,
    duration: "3.2s",
    tokensIn: 1847,
    tokensOut: 0,
    cost: "$0.006",
    safety: "flag" as const,
    input: "Compute CET1",
    output: "Error: RWA source unavailable.",
    steps: [{ label: "Query RWA", status: "warn" as const, duration: "3s" }],
  },
  {
    id: "f7g",
    journey: "IFRS 9 ECL",
    agent: "CFO Office Agent",
    status: "done" as const,
    confidence: 0.91,
    duration: "18.4s",
    tokensIn: 15632,
    tokensOut: 4284,
    cost: "$0.060",
    safety: "flag" as const,
    input: "Report ECL staging",
    output: "Stage 1 89.4%, Stage 2 9.0%, Stage 3 1.6%.",
    steps: [
      { label: "Load staging data", status: "ok" as const, duration: "6s" },
      { label: "Compute migrations", status: "warn" as const, duration: "12s" },
    ],
  },
  {
    id: "g8h",
    journey: "Variance Analysis",
    agent: "Variance Analysis Agent",
    status: "done" as const,
    confidence: 0.93,
    duration: "15.2s",
    tokensIn: 11284,
    tokensOut: 3102,
    cost: "$0.043",
    safety: "clean" as const,
    input: "Draft Q1 variance commentary",
    output: "Draft commentary ready.",
    steps: [{ label: "Query actuals", status: "ok" as const, duration: "5s" }],
  },
];

type FilterTab = "all" | "completed" | "running" | "failed";

export default function AgentRunsPage() {
  const [selectedRun, setSelectedRun] = useState<(typeof SAMPLE_RUNS)[0] | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const filteredRuns = SAMPLE_RUNS.filter((run) => {
    if (filterTab === "completed") return run.status === "done";
    if (filterTab === "running") return run.status === "live";
    if (filterTab === "failed") return run.status === "fail";
    return true;
  });

  const statusMap: Record<string, "active" | "running" | "error"> = {
    done: "active",
    live: "running",
    fail: "error",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <h1
            className="text-[28px] font-bold text-foreground"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Agent Runs
          </h1>
          <SampleDataBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          Execution history with full traceability
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard value="5" label="Runs Today" />
        <MetricCard value="83.5K" label="Tokens" />
        <MetricCard value="$0.25" label="Cost" />
        <MetricCard value="3" label="Safety Flags" />
        <MetricCard value="71%" label="Success Rate" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["all", "completed", "running", "failed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filterTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Runs Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Run ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Journey
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Safety
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run, idx) => (
              <tr
                key={run.id}
                className={`border-b border-border ${
                  idx % 2 === 0 ? "bg-transparent" : "bg-muted/30"
                } hover:bg-muted/50 transition-colors`}
              >
                <td className="px-6 py-4 text-sm font-medium text-foreground">
                  {run.id}
                </td>
                <td className="px-6 py-4 text-sm text-foreground">{run.journey}</td>
                <td className="px-6 py-4 text-sm">
                  <StatusBadge status={statusMap[run.status]} />
                </td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {(run.confidence * 100).toFixed(0)}%
                </td>
                <td className="px-6 py-4 text-sm text-foreground">{run.duration}</td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {run.tokensIn.toLocaleString()}/{run.tokensOut.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-foreground">{run.cost}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      run.safety === "clean"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {run.safety === "clean" ? "Clean" : "Flagged"}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => setSelectedRun(run)}
                    className="inline-flex items-center justify-center p-2 hover:bg-muted rounded-lg transition-colors"
                    title="View run details"
                  >
                    <Eye size={16} className="text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Execution Trace Panel */}
      <ExecutionTracePanel
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}
