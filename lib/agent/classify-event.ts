import type { GCMessage } from "gitclaw";
import type { PipelineStep } from "./pipeline-types";

let stepCounter = 0;

export function resetStepCounter() {
  stepCounter = 0;
}

function nextId(): string {
  return `step-${++stepCounter}`;
}

// Map our custom tool names to human-readable labels
const TOOL_LABELS: Record<string, string> = {
  search_records: "Searching financial records",
  analyze_financial_data: "Analyzing financial data",
  create_actions: "Creating action items",
  update_action: "Updating action",
  generate_commentary: "Generating commentary",
  draft_email: "Drafting email",
  draft_dunning_email: "Drafting dunning email",
  scan_ar_aging: "Scanning AR aging",
  create_ar_actions: "Creating AR actions",
  update_invoice_status: "Updating invoice status",
  generate_variance_report: "Generating variance report",
  generate_ar_summary: "Generating AR summary",
  save_document: "Saving document",
  memory: "Accessing agent memory",
};

export function classifyEvent(msg: GCMessage): PipelineStep | null {
  if (msg.type === "system" && (msg as unknown as Record<string, unknown>).subtype === "session_start") {
    return { id: nextId(), type: "agent_init", label: "Initializing agent...", status: "running" };
  }

  if (msg.type === "tool_use") {
    const toolName = (msg as unknown as Record<string, unknown>).toolName as string;
    const args = (msg as unknown as Record<string, unknown>).args as Record<string, unknown> | undefined;

    // task_tracker — skill discovery
    if (toolName === "task_tracker") {
      const action = args?.action as string | undefined;
      if (action === "begin") {
        return {
          id: nextId(),
          type: "skill_discovery",
          label: "Discovering relevant skills...",
          detail: (args?.objective as string) || undefined,
          status: "running",
        };
      }
      return null; // suppress updates/loaded
    }

    // memory
    if (toolName === "memory") {
      const action = args?.action as string | undefined;
      if (action === "load") {
        return { id: nextId(), type: "memory_load", label: "Loading agent memory...", status: "running" };
      }
      if (action === "save") {
        return { id: nextId(), type: "file_write", label: "Saving to memory...", status: "running" };
      }
    }

    // read — skill vs data file
    if (toolName === "read") {
      const path = (args?.file_path || args?.path || "") as string;
      if (path.includes("skills/") && path.endsWith("SKILL.md")) {
        const skillName = path.split("skills/")[1]?.split("/")[0];
        return { id: nextId(), type: "skill_load", label: `Loading skill — ${skillName}`, file: path, status: "running" };
      }
      if (path.includes("memory/wiki/")) {
        const pageName = path.split("/").pop()?.replace(".md", "");
        return { id: nextId(), type: "file_read", label: `Reading wiki — ${pageName}`, file: path, status: "running" };
      }
      const fileName = path.split("/").pop();
      return { id: nextId(), type: "file_read", label: `Reading ${fileName}`, file: path, status: "running" };
    }

    // write
    if (toolName === "write") {
      const path = (args?.file_path || args?.path || "") as string;
      if (path.includes("memory/wiki/")) {
        const pageName = path.split("/").pop()?.replace(".md", "");
        return { id: nextId(), type: "wiki_update", label: `Updating wiki — ${pageName}`, file: path, status: "running" };
      }
      const fileName = path.split("/").pop();
      return { id: nextId(), type: "file_write", label: `Writing ${fileName}`, file: path, status: "running" };
    }

    // save_document (our custom tool)
    if (toolName === "save_document") {
      return { id: nextId(), type: "file_write", label: "Saving document", status: "running" };
    }

    // Known custom tools
    if (TOOL_LABELS[toolName]) {
      return {
        id: nextId(),
        type: "tool_exec",
        label: TOOL_LABELS[toolName],
        detail: args ? JSON.stringify(args).substring(0, 100) : undefined,
        status: "running",
      };
    }

    // cli
    if (toolName === "cli") {
      return {
        id: nextId(),
        type: "tool_exec",
        label: "Running command",
        detail: (args?.command as string)?.substring(0, 80),
        status: "running",
      };
    }

    // Unknown tool
    return {
      id: nextId(),
      type: "tool_exec",
      label: `Running ${toolName}`,
      detail: args ? JSON.stringify(args).substring(0, 100) : undefined,
      status: "running",
    };
  }

  // tool_result, delta, other — handled elsewhere
  return null;
}
