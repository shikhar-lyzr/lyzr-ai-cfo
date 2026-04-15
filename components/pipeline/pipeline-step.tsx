"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { StepIcon } from "./step-icon";
import type { PipelineStep as PipelineStepType } from "@/lib/agent/pipeline-types";

export function PipelineStepRow({ step }: { step: PipelineStepType }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 py-1 text-sm"
    >
      <StepIcon type={step.type} status={step.status} />

      {step.status === "completed" && (
        <CheckCircle size={12} className="text-success shrink-0" />
      )}
      {step.status === "failed" && (
        <XCircle size={12} className="text-destructive shrink-0" />
      )}

      <span className={step.status === "running" ? "text-muted-foreground" : "text-foreground"}>
        {step.label}
      </span>

      {step.detail && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {step.detail}
        </span>
      )}

      {step.duration !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {(step.duration / 1000).toFixed(1)}s
        </span>
      )}
    </motion.div>
  );
}
