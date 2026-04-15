"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PipelineStepRow } from "./pipeline-step";
import type { PipelineStep } from "@/lib/agent/pipeline-types";

interface PipelineContainerProps {
  steps: PipelineStep[];
  isStreaming: boolean;
}

export function PipelineContainer({ steps, isStreaming }: PipelineContainerProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) return null;

  const allDone = !isStreaming && steps.every((s) => s.status !== "running");

  if (allDone && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
      >
        <ChevronRight size={14} />
        <span className="uppercase tracking-wider font-medium">
          {steps.length} steps completed
        </span>
      </button>
    );
  }

  return (
    <div className="py-1">
      {allDone && (
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
        >
          <ChevronDown size={14} />
          <span className="uppercase tracking-wider font-medium">
            {steps.length} steps completed
          </span>
        </button>
      )}
      {steps.map((step) => (
        <PipelineStepRow key={step.id} step={step} />
      ))}
    </div>
  );
}
