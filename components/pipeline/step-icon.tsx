import {
  Cpu, Compass, BookOpen, Brain, FileSearch, FilePlus,
  Terminal, Sparkles, Network, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import type { StepType } from "@/lib/agent/pipeline-types";

const STEP_ICONS: Record<StepType, { icon: typeof Cpu; color: string }> = {
  agent_init:      { icon: Cpu,          color: "text-gray-500" },
  skill_discovery: { icon: Compass,      color: "text-blue-600" },
  skill_load:      { icon: BookOpen,     color: "text-indigo-600" },
  memory_load:     { icon: Brain,        color: "text-purple-600" },
  file_read:       { icon: FileSearch,   color: "text-teal-600" },
  file_write:      { icon: FilePlus,     color: "text-green-600" },
  tool_exec:       { icon: Terminal,     color: "text-amber-600" },
  llm_thinking:    { icon: Sparkles,     color: "text-violet-500" },
  wiki_update:     { icon: Network,      color: "text-purple-600" },
  output_ready:    { icon: CheckCircle,  color: "text-green-600" },
  error:           { icon: AlertCircle,  color: "text-red-600" },
};

export function StepIcon({ type, status }: { type: StepType; status: string }) {
  if (status === "running") {
    return <Loader2 size={16} className="text-muted-foreground animate-spin" />;
  }
  const config = STEP_ICONS[type];
  const Icon = config.icon;
  return <Icon size={16} className={config.color} />;
}
