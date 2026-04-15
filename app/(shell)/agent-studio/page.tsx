import { SettingsIcon } from "lucide-react";
import { clsx } from "clsx";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { SAMPLE_AGENTS } from "@/lib/config/sample-build-data";

export default function AgentStudioPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-[28px] font-bold text-foreground" style={{ fontFamily: "var(--font-playfair)" }}>
              Agent Studio
            </h1>
            <SampleDataBadge />
          </div>
          <p className="text-sm text-muted-foreground">Control center for all agents in the OS</p>
        </div>
        <button
          disabled
          title="New agent creation coming soon"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>+</span>
          New Agent
        </button>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-2 gap-6">
        {SAMPLE_AGENTS.map((agent) => (
          <div
            key={agent.name}
            className="bg-card border border-border rounded-[var(--radius)] p-6 space-y-4"
          >
            {/* Name + Status */}
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-semibold text-foreground">{agent.name}</h3>
                <StatusBadge status={agent.status} />
              </div>
              {agent.isSubAgent && (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  Sub-agent
                </span>
              )}
            </div>

            {/* Model Tag */}
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">
                {agent.model}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {agent.description}
            </p>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground py-3 border-t border-border">
              <div>
                <span className="font-medium">Runs today:</span>
                <span className="ml-1">{agent.runsToday}</span>
              </div>
              <div>
                <span className="font-medium">Avg latency:</span>
                <span className="ml-1">{agent.avgLatency}</span>
              </div>
              <div>
                <span className="font-medium">Last run:</span>
                <span className="ml-1">{agent.lastRun}</span>
              </div>
            </div>

            {/* Skills Chips */}
            <div className="flex flex-wrap gap-2">
              {agent.skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
                >
                  {skill}
                </span>
              ))}
              {agent.skills.length > 4 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  +{agent.skills.length - 4} more
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                disabled
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Configure
              </button>
              <button
                disabled
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Test Runs
              </button>
              <button
                disabled
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                View Logs
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
