export type StepType =
  | "agent_init"
  | "skill_discovery"
  | "skill_load"
  | "memory_load"
  | "file_read"
  | "file_write"
  | "tool_exec"
  | "llm_thinking"
  | "wiki_update"
  | "output_ready"
  | "error";

export interface PipelineStep {
  id: string;
  type: StepType;
  label: string;
  detail?: string;
  file?: string;
  status: "running" | "completed" | "failed";
  duration?: number;
  content?: string;
}

export type FrontendEvent =
  | { event: "pipeline_step"; data: PipelineStep }
  | { event: "delta"; data: { text: string } }
  | { event: "thinking"; data: { text: string } }
  | { event: "done"; data: { finished: true } }
  | { event: "error"; data: { error: string } };
