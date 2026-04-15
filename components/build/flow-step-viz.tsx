import { Lock } from "lucide-react";

interface FlowStepVizProps {
  steps: Array<{ type: "step" | "gate"; completed: boolean }>;
}

export function FlowStepViz({ steps }: FlowStepVizProps) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          {/* Circle or Lock Icon */}
          <div className="relative flex items-center justify-center">
            {step.type === "gate" ? (
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border border-border ${
                  step.completed
                    ? "bg-primary border-primary"
                    : "bg-bg-card border-border"
                }`}
              >
                <Lock
                  className={`w-3.5 h-3.5 ${
                    step.completed ? "text-white" : "text-muted-foreground"
                  }`}
                />
              </div>
            ) : (
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  step.completed ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>

          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div className="h-px w-6 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}
