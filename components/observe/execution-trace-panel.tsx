"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBadge } from "@/components/shared/status-badge";

interface ExecutionTracePanelProps {
  run: {
    id: string;
    journey: string;
    agent: string;
    status: "done" | "live" | "fail";
    confidence: number;
    duration: string;
    tokensIn: number;
    tokensOut: number;
    cost: string;
    safety: "clean" | "flag";
    input: string;
    output: string;
    steps: { label: string; status: "ok" | "warn"; duration: string }[];
  } | null;
  onClose: () => void;
}

const SAFETY_METRICS = [
  { label: "PII Redaction", status: "pass", note: "No PII detected" },
  { label: "Data Boundary", status: "pass", note: "Within policy" },
  { label: "Threshold Check", status: "pass", note: "Under limits" },
  { label: "Hallucination Guard", status: "pass", note: "No hallucinations" },
  { label: "Authorization", status: "pass", note: "Authorized action" },
];

export function ExecutionTracePanel({ run, onClose }: ExecutionTracePanelProps) {
  const statusMap: Record<string, "active" | "running" | "error"> = {
    done: "active",
    live: "running",
    fail: "error",
  };

  return (
    <AnimatePresence>
      {run && (
        <>
          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* Slide-over panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed right-0 top-0 w-[480px] h-full bg-background border-l border-border z-50 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Run {run.id}</h2>
                  <StatusBadge status={statusMap[run.status]} />
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Agent</span>
                  <p className="text-sm text-foreground">{run.agent}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Journey</span>
                  <p className="text-sm text-foreground">{run.journey}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Trigger</span>
                  <p className="text-sm text-foreground">Automated pipeline</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Model</span>
                  <p className="text-sm text-foreground">Claude Sonnet 4.6</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Tokens In</span>
                  <p className="text-sm text-foreground">{run.tokensIn.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Tokens Out</span>
                  <p className="text-sm text-foreground">{run.tokensOut.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Cost</span>
                  <p className="text-sm text-foreground">{run.cost}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Confidence</span>
                  <p className="text-sm text-foreground">{(run.confidence * 100).toFixed(0)}%</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-muted-foreground">Duration</span>
                  <p className="text-sm text-foreground">{run.duration}</p>
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <span className="text-xs uppercase font-semibold text-muted-foreground">Input</span>
                <div className="bg-muted/30 border border-border rounded-sm font-mono text-xs p-3 text-foreground">
                  {run.input}
                </div>
              </div>

              {/* Output */}
              <div className="space-y-2">
                <span className="text-xs uppercase font-semibold text-muted-foreground">Output</span>
                <div className="bg-muted/30 border border-border rounded-sm font-mono text-xs p-3 text-foreground">
                  {run.output}
                </div>
              </div>

              {/* Safety Metrics */}
              <div className="space-y-3">
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Safety Metrics</span>
                <div className="grid grid-cols-1 gap-2">
                  {SAFETY_METRICS.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex items-start gap-3 p-3 bg-muted/20 rounded-sm border border-border"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{metric.label}</p>
                        <p className="text-xs text-muted-foreground">{metric.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step-by-step Trace */}
              <div className="space-y-3">
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Execution Trace</span>
                <div className="space-y-2">
                  {run.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-sm border ${
                        step.status === "warn"
                          ? "bg-amber-50/50 border-amber-200"
                          : "bg-muted/20 border-border"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          step.status === "warn" ? "bg-amber-500" : "bg-green-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
