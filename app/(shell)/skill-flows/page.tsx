"use client";

import { Plus } from "lucide-react";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { FlowStepViz } from "@/components/build/flow-step-viz";

interface FlowStep {
  type: "step" | "gate";
  completed: boolean;
  label: string;
}

interface SkillFlow {
  name: string;
  description: string;
  status: "active";
  steps: FlowStep[];
  lastRun: string;
  progressText: string;
}

const SAMPLE_FLOWS: SkillFlow[] = [
  {
    name: "Monthly Reconciliation Suite",
    description: "7 skills in sequence with a controller review gate",
    status: "active",
    steps: [
      { type: "step", completed: true, label: "Sub-ledger" },
      { type: "step", completed: true, label: "Bank" },
      { type: "step", completed: true, label: "AR" },
      { type: "step", completed: true, label: "AP" },
      { type: "step", completed: true, label: "IC" },
      { type: "step", completed: true, label: "Exception" },
      { type: "gate", completed: false, label: "Controller Review" },
      { type: "step", completed: false, label: "Adjustment" },
    ],
    lastRun: "2 hours ago",
    progressText: "6/8",
  },
  {
    name: "Financial Close Pipeline",
    description: "Pre-close validation through reporting, with dual approval gates",
    status: "active",
    steps: [
      { type: "step", completed: true, label: "Pre-close" },
      { type: "step", completed: true, label: "Journal posting" },
      { type: "gate", completed: true, label: "Controller" },
      { type: "step", completed: false, label: "Consolidation" },
      { type: "gate", completed: false, label: "CFO" },
      { type: "step", completed: false, label: "Reporting" },
    ],
    lastRun: "Yesterday",
    progressText: "3/6",
  },
  {
    name: "Regulatory Filing Workflow",
    description: "Extract, validate, file, and confirm — compliance gate before filing",
    status: "active",
    steps: [
      { type: "step", completed: true, label: "Data extraction" },
      { type: "step", completed: true, label: "Validation" },
      { type: "gate", completed: true, label: "Compliance" },
      { type: "step", completed: true, label: "Filing" },
      { type: "step", completed: false, label: "Confirmation" },
    ],
    lastRun: "3 days ago",
    progressText: "4/5",
  },
];

function FlowCard({ flow }: { flow: SkillFlow }) {
  const skillSteps = flow.steps.filter((s) => s.type === "step").length;
  const gates = flow.steps.filter((s) => s.type === "gate").length;

  return (
    <div className="bg-bg-card border border-border rounded-[var(--radius)] p-5 hover:border-border/60 transition-colors">
      {/* Header with name and status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{flow.name}</h3>
        </div>
        <StatusBadge status={flow.status} />
      </div>

      {/* Description */}
      <p className="text-xs text-text-muted-foreground mb-4">
        {flow.description}
      </p>

      {/* Steps summary */}
      <p className="text-xs text-text-muted-foreground mb-3">
        {skillSteps} skill steps • {gates} approval gates
      </p>

      {/* Flow visualization */}
      <div className="mb-4">
        <FlowStepViz steps={flow.steps} />
      </div>

      {/* Progress and last run */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-text-muted-foreground">
          {flow.progressText} complete
        </span>
        <span className="text-xs text-text-muted-foreground">
          Last run: {flow.lastRun}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          disabled
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-[var(--radius)] border border-border bg-bg-card text-text-muted-foreground cursor-not-allowed opacity-50 transition-colors"
        >
          Run
        </button>
        <button
          disabled
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-[var(--radius)] border border-border bg-bg-card text-text-muted-foreground cursor-not-allowed opacity-50 transition-colors"
        >
          Edit
        </button>
        <button
          disabled
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-[var(--radius)] border border-border bg-bg-card text-text-muted-foreground cursor-not-allowed opacity-50 transition-colors"
        >
          History
        </button>
      </div>
    </div>
  );
}

export default function SkillFlowsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1
            className="text-[28px] font-semibold text-foreground"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Skill Flows
          </h1>
          <SampleDataBadge />
        </div>
        <p className="text-sm text-text-muted-foreground">
          Multi-skill workflows with approval gates
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-text-muted-foreground">
          3 Flows • 22 Total Steps • 4 Approval Gates • 3 Active
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--radius)] bg-primary text-white cursor-not-allowed opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Flow
        </button>
      </div>

      {/* Flow cards grid */}
      <div className="grid grid-cols-1 gap-6">
        {SAMPLE_FLOWS.map((flow) => (
          <FlowCard key={flow.name} flow={flow} />
        ))}
      </div>
    </div>
  );
}
